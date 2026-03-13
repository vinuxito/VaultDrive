package main

import (
	"crypto/tls"
	"fmt"
	"log"
	"sync"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
)

// IMAPClient wraps an IMAP connection
type IMAPClient struct {
	client   *client.Client
	username string
}

type EmailMessage struct {
	UID     uint32 `json:"uid"`
	Subject string `json:"subject"`
	From    string `json:"from"`
	Date    string `json:"date"`
	Seen    bool   `json:"seen"`
}

type Mailbox struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Messages int    `json:"messages"`
	Unseen   int    `json:"unseen"`
}

// connectToIMAP establishes TLS connection and authenticates
func connectToIMAP(host string, port int, username string, password string) (*IMAPClient, error) {
	serverAddr := fmt.Sprintf("%s:%d", host, port)
	log.Printf("Connecting to IMAP: %s for %s", serverAddr, username)

	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         host,
	}

	c, err := client.DialTLS(serverAddr, tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("IMAP connection failed: %w", err)
	}

	log.Printf("Connected, authenticating...")

	if err := c.Login(username, password); err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	log.Printf("Authenticated as %s", username)
	return &IMAPClient{client: c, username: username}, nil
}

// ListMailboxes lists mailboxes
func (ic *IMAPClient) ListMailboxes() ([]Mailbox, error) {
	if ic.client == nil {
		return nil, fmt.Errorf("not connected")
	}

	log.Printf("Listing mailboxes for %s...", ic.username)

	mailboxes := make(chan *imap.MailboxInfo, 10)
	done := make(chan error, 1)

	go func() {
		done <- ic.client.List("", "*", mailboxes)
	}()

	var list []Mailbox

	for m := range mailboxes {
		log.Printf("Mailbox: %s", m.Name)

		messageBox, err := ic.client.Select(m.Name, false)
		if err != nil {
			log.Printf("  Select failed: %v", err)
			continue
		}

		list = append(list, Mailbox{
			ID:       m.Name,
			Name:     m.Name,
			Messages: int(messageBox.Messages),
			Unseen:   int(messageBox.Unseen),
		})
		log.Printf("  Status: %d total, %d unseen", messageBox.Messages, messageBox.Unseen)
	}

	if err := <-done; err != nil {
		log.Printf("List error: %v", err)
		return nil, fmt.Errorf("list failed: %w", err)
	}

	return list, nil
}

// FetchRecentMessages fetches recent emails
func (ic *IMAPClient) FetchRecentMessages(mailboxName string, count int) ([]EmailMessage, error) {
	if ic.client == nil {
		return nil, fmt.Errorf("not connected")
	}

	log.Printf("Fetching %d messages from %s", count, mailboxName)

	messageBox, err := ic.client.Select(mailboxName, false)
	if err != nil {
		return nil, fmt.Errorf("select failed: %w", err)
	}

	if messageBox.Messages == 0 {
		log.Printf("%s is empty", mailboxName)
		return []EmailMessage{}, nil
	}

	totalMessages := messageBox.Messages
	log.Printf("Total: %d, fetching %d", totalMessages, count)

	from := uint32(1)
	if totalMessages > uint32(count) {
		from = totalMessages - uint32(count) + 1
	}

	seqset := new(imap.SeqSet)
	seqset.AddRange(from, totalMessages)

	log.Printf("Fetching messages from position %d", from)

	messages := make(chan *imap.Message, count)
	errChan := make(chan error, 1)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		errChan <- ic.client.Fetch(seqset, []imap.FetchItem{imap.FetchEnvelope}, messages)
	}()

	emails := []EmailMessage{}
	processed := 0
	fetchComplete := false

	for !fetchComplete || len(messages) > 0 {
		select {
		case msg, ok := <-messages:
			if !ok {
				fetchComplete = true
				break
			}
			if msg == nil || msg.Envelope == nil {
				continue
			}

			if len(emails) >= count {
				break
			}

			seen := false
			for _, flag := range msg.Flags {
				if flag == imap.SeenFlag {
					seen = true
					break
				}
			}

			var fromAddr string
			if len(msg.Envelope.From) > 0 {
				fromAddr = msg.Envelope.From[0].Address()
			}

			dateStr := ""
			if !msg.Envelope.Date.IsZero() {
				dateStr = msg.Envelope.Date.Format("2006-01-02T15:04:05Z07:00")
			}

			emails = append(emails, EmailMessage{
				UID:     msg.Uid,
				Subject: msg.Envelope.Subject,
				From:    fromAddr,
				Date:    dateStr,
				Seen:    seen,
			})

			log.Printf("#%d: %s", msg.Uid, msg.Envelope.Subject)
			processed++

		case err := <-errChan:
			if err != nil {
				log.Printf("Fetch error: %v", err)
			}
		}
	}

	wg.Wait()

	if err := <-errChan; err != nil {
		log.Printf("Fetch completed with error: %v", err)
	}

	log.Printf("Fetched %d messages", len(emails))
	return emails, nil
}

// GetMailbox gets mailbox status
func (ic *IMAPClient) GetMailbox(mailboxName string) (Mailbox, error) {
	if ic.client == nil {
		return Mailbox{}, fmt.Errorf("not connected")
	}

	log.Printf("Getting %s status", mailboxName)

	messageBox, err := ic.client.Select(mailboxName, false)
	if err != nil {
		return Mailbox{}, fmt.Errorf("select failed: %w", err)
	}

	return Mailbox{
		ID:       mailboxName,
		Name:     mailboxName,
		Messages: int(messageBox.Messages),
		Unseen:   int(messageBox.Unseen),
	}, nil
}

// CloseConnection closes IMAP connection
func (ic *IMAPClient) CloseConnection() error {
	if ic.client == nil {
		return fmt.Errorf("not connected")
	}

	log.Printf("Closing connection for %s", ic.username)

	if err := ic.client.Logout(); err != nil {
		return fmt.Errorf("logout failed: %w", err)
	}

	return nil
}
