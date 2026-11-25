export type CpuUsage = {
  readonly userMicroseconds: number;
  readonly systemMicroseconds: number;
};

export type CpuUsagePort = {
  readonly read: () => CpuUsage;
};
