import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Trash2,
  Download,
  AlertCircle,
} from "lucide-react";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import {
  runAllTests,
  cleanupTestData,
  type TestCategory,
  type TestResult,
} from "../utils/test-runner";

export default function AdminTests() {
  const [categories, setCategories] = useState<TestCategory[]>([]);
  const [running, setRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>("");
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string>("");

  const handleRunAllTests = async () => {
    setRunning(true);
    setCategories([]);
    setCleanupMessage("");

    const results = await runAllTests((result: TestResult) => {
      setCurrentTest(result.name);
      setCategories((prev) => {
        // Update categories with new result
        const newCategories = [...prev];
        const categoryIndex = newCategories.findIndex((cat) =>
          cat.tests.some((t) => t.name === result.name)
        );

        if (categoryIndex >= 0) {
          const testIndex = newCategories[categoryIndex].tests.findIndex(
            (t) => t.name === result.name
          );
          if (testIndex >= 0) {
            newCategories[categoryIndex].tests[testIndex] = result;
          }
        }

        return newCategories;
      });
    });

    setCategories(results);
    setRunning(false);
    setCurrentTest("");
  };

  const handleCleanup = async () => {
    setCleaning(true);
    setCleanupMessage("");

    const result = await cleanupTestData();
    setCleanupMessage(
      result.success
        ? `✅ ${result.message}`
        : `❌ ${result.message}`
    );

    setCleaning(false);
  };

  const handleExportResults = () => {
    const json = JSON.stringify(categories, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abrn-drive-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTotalStats = () => {
    const allTests = categories.flatMap((cat) => cat.tests);
    return {
      total: allTests.length,
      passed: allTests.filter((t) => t.pass).length,
      failed: allTests.filter((t) => !t.pass).length,
    };
  };

  const stats = getTotalStats();

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">System Tests</h1>
          <p className="text-muted-foreground">
            Run comprehensive tests to verify ABRN Drive functionality
          </p>
        </div>

        {/* Action Buttons */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleRunAllTests}
                disabled={running}
                className="gap-2"
                size="lg"
              >
                {running ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Run All Tests
                  </>
                )}
              </Button>

              <Button
                onClick={handleCleanup}
                disabled={cleaning || running}
                variant="outline"
                className="gap-2"
                size="lg"
              >
                {cleaning ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Clear Test Data
                  </>
                )}
              </Button>

              {categories.length > 0 && (
                <Button
                  onClick={handleExportResults}
                  variant="outline"
                  className="gap-2"
                  size="lg"
                >
                  <Download className="w-5 h-5" />
                  Export Results
                </Button>
              )}
            </div>

            {cleanupMessage && (
              <div className="mt-4 p-3 rounded-md bg-muted">
                <p className="text-sm">{cleanupMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overall Stats */}
        {categories.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Test Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">
                    Total Tests
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.passed}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Test */}
        {running && currentTest && (
          <Card className="mb-6 border-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 animate-spin text-[#7d4f50]" />
                <span className="font-medium">Running: {currentTest}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results by Category */}
        {categories.map((category, catIndex) => (
          <Card key={catIndex} className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{category.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {category.tests.filter((t) => t.pass).length} /{" "}
                  {category.tests.length} passed
                </span>
              </CardTitle>
              <CardDescription>
                {category.tests.length} test{category.tests.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {category.tests.map((test, testIndex) => (
                  <div
                    key={testIndex}
                    className={`p-4 rounded-lg border ${
                      test.pass
                        ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {test.pass ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium mb-1">{test.name}</div>
                          <div
                            className={`text-sm ${
                              test.pass ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                            }`}
                          >
                            {test.message}
                          </div>
                          {test.error && (
                            <div className="mt-2 p-2 rounded bg-red-100 dark:bg-red-900 text-xs font-mono overflow-x-auto">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>{test.error}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground ml-4">
                        {test.duration}ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Empty State */}
        {!running && categories.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Play className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                No tests run yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Click "Run All Tests" to start testing the system
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
