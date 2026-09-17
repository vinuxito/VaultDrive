package main

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func TestSetPINRejectsMissingOrUnboundedKeyEnvelopeBeforeMutation(t *testing.T) {
	validEnvelope := strings.Repeat("a", 32)
	cases := []string{
		`{"pin":"1234","private_key_pin_encrypted":"","kek_envelope_version":2}`,
		`{"pin":"1234","private_key_pin_encrypted":"` + validEnvelope + `"}`,
		`{"pin":"1234","private_key_pin_encrypted":"` + validEnvelope + `","kek_envelope_version":3}`,
		`{"pin":"1234","private_key_pin_encrypted":"` + strings.Repeat("a", 512*1024+1) + `","kek_envelope_version":2}`,
	}
	for i, body := range cases {
		w := httptest.NewRecorder()
		(&ApiConfig{}).handlerSetUserPIN(w, httptest.NewRequest(http.MethodPost, "/api/users/pin", strings.NewReader(body)), database.User{ID: uuid.New()})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("case %d status=%d body=%s", i, w.Code, w.Body.String())
		}
	}
}

func TestSetPINMutationRejectsInvalidEnvelopeBeforeOpeningTransaction(t *testing.T) {
	err := (&ApiConfig{}).setPINAtomically(t.Context(), uuid.New(), setPINMutation{
		PINHash: "hash", KekEnvelopeVersion: 2, HasKekEnvelopeVersion: true,
	}, httptest.NewRequest(http.MethodPost, "/api/users/pin", nil))
	if err == nil || !strings.Contains(err.Error(), "valid PIN key envelope") {
		t.Fatalf("invalid mutation error=%v", err)
	}
}

func TestRecoveryResetRejectsVersionDowngradeBeforeDatabaseWork(t *testing.T) {
	raw, _, err := newRecoveryCapability()
	if err != nil {
		t.Fatal(err)
	}
	body := `{"new_password_hash":"new-password","new_private_key_encrypted":"01234567890123456789012345678901","kek_envelope_version":1}`
	r := httptest.NewRequest(http.MethodPost, "/api/v1/recovery/reset", strings.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+raw)
	w := httptest.NewRecorder()
	(&ApiConfig{}).handlerResetRecoveryPasswordV2(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("downgrade status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestRecoveryLookupDatabaseFaultIsUnavailableNotUnauthorized(t *testing.T) {
	injected := errors.New("injected database lookup fault secret")
	w := httptest.NewRecorder()
	committed := false
	if !respondRecoveryLookupFailure(w, injected, "Recovery status is unavailable", "Recovery request is unavailable", func() error {
		committed = true
		return nil
	}) {
		t.Fatal("lookup fault was not handled")
	}
	if w.Code != http.StatusServiceUnavailable || committed {
		t.Fatalf("fault status=%d committed=%v", w.Code, committed)
	}
	if bytes.Contains(w.Body.Bytes(), []byte("injected")) || bytes.Contains(w.Body.Bytes(), []byte("secret")) {
		t.Fatalf("internal lookup fault leaked: %s", w.Body.String())
	}
}

func TestRecoveryCapabilityBearerIsOpaqueAndHashed(t *testing.T) {
	raw, hash, err := newRecoveryCapability()
	if err != nil {
		t.Fatal(err)
	}
	if raw == "" || len(hash) != 64 || strings.Contains(hash, raw) {
		t.Fatalf("unexpected raw/hash pair: raw=%q hash=%q", raw, hash)
	}

	r := httptest.NewRequest("GET", "/api/v1/recovery/status?username=victim", nil)
	r.Header.Set("Authorization", "Bearer "+raw)
	got, err := recoveryCapabilityFromRequest(r)
	if err != nil {
		t.Fatal(err)
	}
	if got != raw {
		t.Fatalf("got capability %q, want exact bearer token", got)
	}
	if gotHash := hashRecoveryCapability(got); gotHash != hash {
		t.Fatalf("got hash %q, want %q", gotHash, hash)
	}
}

func TestRecoveryCapabilityRejectsJWTAndMissingBearer(t *testing.T) {
	for _, header := range []string{"", "Bearer header.payload.signature", "Basic abc"} {
		r := httptest.NewRequest("GET", "/api/v1/recovery/status", nil)
		r.Header.Set("Authorization", header)
		if _, err := recoveryCapabilityFromRequest(r); err == nil {
			t.Fatalf("expected header %q to be rejected", header)
		}
	}
}

func TestRecoveryCapabilityIPLimitRejectsRotatedTokensBeforeDatabaseWork(t *testing.T) {
	previousIPLimiter := recoveryIPRateLimiter
	previousCapabilityLimiter := recoveryCapabilityRateLimiter
	t.Cleanup(func() {
		recoveryIPRateLimiter = previousIPLimiter
		recoveryCapabilityRateLimiter = previousCapabilityLimiter
	})
	recoveryIPRateLimiter = newSlidingWindow()
	recoveryCapabilityRateLimiter = newSlidingWindow()
	const remoteAddress = "203.0.113.10:43210"
	for i := 0; i < 50; i++ {
		r := httptest.NewRequest(http.MethodPost, "/api/v1/recovery/reset", nil)
		r.RemoteAddr = remoteAddress
		if !allowRecoveryRequest(r, "reset:"+hashRecoveryCapability(uuid.NewString()), 5, time.Hour) {
			t.Fatalf("rotated capability %d was limited before the IP budget was exhausted", i)
		}
	}
	raw, _, err := newRecoveryCapability()
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/api/v1/recovery/reset", strings.NewReader(`{"new_password_hash":"new-password","new_private_key_encrypted":"01234567890123456789012345678901","kek_envelope_version":2}`))
	r.RemoteAddr = remoteAddress
	r.Header.Set("Authorization", "Bearer "+raw)
	w := httptest.NewRecorder()
	(&ApiConfig{}).handlerResetRecoveryPasswordV2(w, r)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("rotated capability should be rejected before database work: status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestValidateRecoveryConfigurationRequiresUniqueRealCustodiansAndBoundedPayload(t *testing.T) {
	ownerID := uuid.New()
	custodianID := uuid.New()
	valid := saveRecoverySharesPayload{
		Threshold: 1,
		Shares: []recoveryShareInput{{
			CustodianID: custodianID.String(), WrappedSharePayload: `{"wrapped_key":"a","iv":"b","ciphertext":"c"}`,
		}},
	}
	if _, err := validateRecoveryConfiguration(ownerID, valid); err != nil {
		t.Fatalf("valid configuration rejected: %v", err)
	}

	cases := []saveRecoverySharesPayload{
		{Threshold: 1, Shares: []recoveryShareInput{{CustodianID: ownerID.String(), WrappedSharePayload: "x"}}},
		{Threshold: 2, Shares: valid.Shares},
		{Threshold: 1, Shares: []recoveryShareInput{
			{CustodianID: custodianID.String(), WrappedSharePayload: "x"},
			{CustodianID: custodianID.String(), WrappedSharePayload: "y"},
		}},
		{Threshold: 1, Shares: []recoveryShareInput{{CustodianID: custodianID.String(), WrappedSharePayload: strings.Repeat("x", maxRecoveryWrappedPayloadBytes+1)}}},
	}
	for i, payload := range cases {
		if _, err := validateRecoveryConfiguration(ownerID, payload); err == nil {
			t.Fatalf("case %d should fail validation", i)
		}
	}
}
