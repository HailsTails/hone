import type { Result } from "../../src/domain/result.ts";
import type { CpuUsage } from "./cpu-usage-port.ts";

export type CpuTimeLineFailure = { readonly kind: "cpu-time-line-missing" };

const CPU_TIME_MARKER = "hone-speed-baseline-cpu-time-microseconds";

const CPU_TIME_LINE = new RegExp(`^${CPU_TIME_MARKER} (\\d+)$`, "m");

const WRITTEN_CPU_TIME_LINE = new RegExp(`\\n${CPU_TIME_MARKER} \\d+\\n`, "g");

export const mapCpuUsageToCpuTimeLine = (request: { readonly usage: CpuUsage }): string =>
  `\n${CPU_TIME_MARKER} ${request.usage.userMicroseconds + request.usage.systemMicroseconds}\n`;

export const mapOutputToCpuTime = (request: {
  readonly output: string;
}): Result<number, CpuTimeLineFailure> => {
  const digits = CPU_TIME_LINE.exec(request.output)?.[1];
  return digits === undefined
    ? { outcome: "failed", error: { kind: "cpu-time-line-missing" } }
    : { outcome: "ok", value: Number(digits) };
};

export const mapOutputToCheckOutput = (request: { readonly output: string }): string =>
  request.output.replace(WRITTEN_CPU_TIME_LINE, "").trimEnd();
