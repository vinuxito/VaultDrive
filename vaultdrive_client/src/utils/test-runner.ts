import { API_URL } from "./api";

export interface TestResult {
  name: string;
  pass: boolean;
  message: string;
  duration: number;
  error?: string;
}

export interface TestCategory {
  name: string;
  tests: TestResult[];
}

export type TestStatus = "pending" | "running" | "passed" | "failed";

// Helper to get auth token
function getToken(): string {
  return localStorage.getItem("token") || "";
}

// Helper to make authenticated requests
async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getToken()}`,
    },
  });
}

// Test runner
export async function runTest(
  testFn: () => Promise<TestResult>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await testFn();
    return {
      ...result,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: testFn.name,
      pass: false,
      message: "Test threw an exception",
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============================================
// FILE MANAGEMENT TESTS
// ============================================

export async function testFileUpload(): Promise<TestResult> {
  try {
    const testContent = "Test file content for ABRN Drive";
    const blob = new Blob([testContent], { type: "text/plain" });
    const file = new File([blob], "test_file_upload.txt", {
      type: "text/plain",
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", "test123");

    const response = await authFetch(`${API_URL}/files`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        name: "File Upload",
        pass: false,
        message: `Upload failed with status ${response.status}`,
        error,
        duration: 0,
      };
    }

    return {
      name: "File Upload",
      pass: true,
      message: "Successfully uploaded test file",
      duration: 0,
    };
  } catch (error) {
    return {
      name: "File Upload",
      pass: false,
      message: "Exception during upload",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

export async function testFileList(): Promise<TestResult> {
  try {
    const response = await authFetch(`${API_URL}/files`);

    if (!response.ok) {
      return {
        name: "File List",
        pass: false,
        message: `Failed to fetch files: ${response.status}`,
        duration: 0,
      };
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
      return {
        name: "File List",
        pass: false,
        message: "Response is not an array",
        duration: 0,
      };
    }

    return {
      name: "File List",
      pass: true,
      message: `Successfully retrieved ${files.length} file(s)`,
      duration: 0,
    };
  } catch (error) {
    return {
      name: "File List",
      pass: false,
      message: "Exception during file list",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

export async function testFileMetadataDisplay(): Promise<TestResult> {
  try {
    const response = await authFetch(`${API_URL}/files`);
    const files = await response.json();

    if (files.length === 0) {
      return {
        name: "File Metadata Display",
        pass: true,
        message: "No files to check (upload a file first)",
        duration: 0,
      };
    }

    const file = files[0];
    const hasRequiredFields =
      file.id &&
      file.filename &&
      file.file_size !== undefined &&
      file.created_at &&
      file.metadata !== undefined;

    if (!hasRequiredFields) {
      return {
        name: "File Metadata Display",
        pass: false,
        message: "File missing required fields",
        error: JSON.stringify(file, null, 2),
        duration: 0,
      };
    }

    return {
      name: "File Metadata Display",
      pass: true,
      message: "File metadata structure is correct",
      duration: 0,
    };
  } catch (error) {
    return {
      name: "File Metadata Display",
      pass: false,
      message: "Exception during metadata check",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

// ============================================
// GROUP MANAGEMENT TESTS
// ============================================

export async function testGroupCreate(): Promise<TestResult> {
  try {
    const groupName = `test_group_${Date.now()}`;
    const response = await authFetch(`${API_URL}/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: groupName,
        description: "Test group for automated testing",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        name: "Group Create",
        pass: false,
        message: `Failed to create group: ${response.status}`,
        error,
        duration: 0,
      };
    }

    const group = await response.json();

    return {
      name: "Group Create",
      pass: true,
      message: `Successfully created group: ${group.name}`,
      duration: 0,
    };
  } catch (error) {
    return {
      name: "Group Create",
      pass: false,
      message: "Exception during group creation",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

export async function testGroupList(): Promise<TestResult> {
  try {
    const response = await authFetch(`${API_URL}/groups`);

    if (!response.ok) {
      return {
        name: "Group List",
        pass: false,
        message: `Failed to fetch groups: ${response.status}`,
        duration: 0,
      };
    }

    const groups = await response.json();

    if (!Array.isArray(groups)) {
      return {
        name: "Group List",
        pass: false,
        message: "Response is not an array",
        duration: 0,
      };
    }

    return {
      name: "Group List",
      pass: true,
      message: `Successfully retrieved ${groups.length} group(s)`,
      duration: 0,
    };
  } catch (error) {
    return {
      name: "Group List",
      pass: false,
      message: "Exception during group list",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

// ============================================
// GROUP FILE SHARING TESTS (CRITICAL!)
// ============================================

export async function testGroupFileSharing(): Promise<TestResult> {
  try {
    // Step 1: Create test group
    const groupName = `test_share_group_${Date.now()}`;
    const groupResponse = await authFetch(`${API_URL}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: groupName,
        description: "Test file sharing",
      }),
    });

    if (!groupResponse.ok) {
      return {
        name: "Group File Sharing",
        pass: false,
        message: "Failed to create test group",
        duration: 0,
      };
    }

    const group = await groupResponse.json();

    // Step 2: Upload test file
    const blob = new Blob(["Test sharing content"], { type: "text/plain" });
    const file = new File([blob], `test_share_${Date.now()}.txt`);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", "test123");

    const fileResponse = await authFetch(`${API_URL}/files`, {
      method: "POST",
      body: formData,
    });

    if (!fileResponse.ok) {
      return {
        name: "Group File Sharing",
        pass: false,
        message: "Failed to upload test file",
        duration: 0,
      };
    }

    const uploadedFile = await fileResponse.json();

    // Step 3: Share file to group (THE CRITICAL TEST!)
    const shareResponse = await authFetch(
      `${API_URL}/groups/${group.id}/files`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: uploadedFile.id,
          wrapped_key: "test_wrapped_key_123",
        }),
      }
    );

    if (shareResponse.status === 400) {
      const error = await shareResponse.text();
      return {
        name: "Group File Sharing",
        pass: false,
        message: "❌ 400 BAD REQUEST - THE MAIN BUG IS BACK!",
        error,
        duration: 0,
      };
    }

    if (!shareResponse.ok) {
      const error = await shareResponse.text();
      return {
        name: "Group File Sharing",
        pass: false,
        message: `Share failed with status ${shareResponse.status}`,
        error,
        duration: 0,
      };
    }

    return {
      name: "Group File Sharing",
      pass: true,
      message: "✅ File successfully shared to group (NO 400 ERROR!)",
      duration: 0,
    };
  } catch (error) {
    return {
      name: "Group File Sharing",
      pass: false,
      message: "Exception during file sharing test",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

export async function testSharedFileVisibility(): Promise<TestResult> {
  try {
    const response = await authFetch(`${API_URL}/files`);

    if (!response.ok) {
      return {
        name: "Shared File Visibility",
        pass: false,
        message: "Failed to fetch files",
        duration: 0,
      };
    }

    const files = await response.json();
    const sharedFiles = files.filter((f: any) => f.shared_from === "group");

    return {
      name: "Shared File Visibility",
      pass: true,
      message: `Found ${sharedFiles.length} group-shared file(s) in file list`,
      duration: 0,
    };
  } catch (error) {
    return {
      name: "Shared File Visibility",
      pass: false,
      message: "Exception during visibility check",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

export async function testSharedFileMetadata(): Promise<TestResult> {
  try {
    const response = await authFetch(`${API_URL}/files`);
    const files = await response.json();
    const sharedFile = files.find((f: any) => f.shared_from === "group");

    if (!sharedFile) {
      return {
        name: "Shared File Metadata",
        pass: true,
        message: "No shared files to test (share a file to a group first)",
        duration: 0,
      };
    }

    const hasRequiredFields =
      sharedFile.group_name &&
      sharedFile.group_id &&
      sharedFile.owner_email &&
      sharedFile.shared_by_email &&
      sharedFile.shared_at;

    if (!hasRequiredFields) {
      return {
        name: "Shared File Metadata",
        pass: false,
        message: "Shared file missing required metadata fields",
        error: JSON.stringify(sharedFile, null, 2),
        duration: 0,
      };
    }

    return {
      name: "Shared File Metadata",
      pass: true,
      message: `Shared file has all metadata: owner=${sharedFile.owner_name}, group=${sharedFile.group_name}`,
      duration: 0,
    };
  } catch (error) {
    return {
      name: "Shared File Metadata",
      pass: false,
      message: "Exception during metadata check",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

// ============================================
// TEST SUITE RUNNER
// ============================================

export async function runAllTests(
  onProgress?: (result: TestResult) => void
): Promise<TestCategory[]> {
  const categories: TestCategory[] = [
    {
      name: "File Management",
      tests: [],
    },
    {
      name: "Group Management",
      tests: [],
    },
    {
      name: "Group File Sharing (Critical)",
      tests: [],
    },
  ];

  // Run file tests
  const fileTests = [testFileUpload, testFileList, testFileMetadataDisplay];
  for (const test of fileTests) {
    const result = await runTest(test);
    categories[0].tests.push(result);
    onProgress?.(result);
  }

  // Run group tests
  const groupTests = [testGroupCreate, testGroupList];
  for (const test of groupTests) {
    const result = await runTest(test);
    categories[1].tests.push(result);
    onProgress?.(result);
  }

  // Run critical sharing tests
  const sharingTests = [
    testGroupFileSharing,
    testSharedFileVisibility,
    testSharedFileMetadata,
  ];
  for (const test of sharingTests) {
    const result = await runTest(test);
    categories[2].tests.push(result);
    onProgress?.(result);
  }

  return categories;
}

// Clean up test data
export async function cleanupTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await authFetch(`${API_URL}/admin/test-cleanup`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Cleanup failed: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Test data cleaned up successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
