// Prints the error-code taxonomy as a Markdown table, from the registry
// itself, so docs/API/05-ERROR-HANDLING.md can never drift from the code.
//   pnpm tsx scripts/error-codes-table.ts
import { ERROR_CODES, type ErrorCode } from "../packages/errors/src/codes";

const rows = (Object.keys(ERROR_CODES) as ErrorCode[]).map((code) => {
  const { status, retryable, message } = ERROR_CODES[code];
  return `| \`${code}\` | ${status} | ${retryable ? "yes" : "no"} | ${message} |`;
});
process.stdout.write(["| Code | Status | Retryable | Default message |", "|---|---|---|---|", ...rows].join("\n") + "\n");
