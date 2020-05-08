# Memory Counters

### LMK
### meminfo
### per-process-stats
### virtual memory stats

## Sys stats
This data source allows periodic polling of system data from 

- `proc/stat`
- `proc/vmstat`
- `proc/meminfo`

![](/docs/images/sys_stat_counters.png)

The polling period and specific counters to include in the trace can be set in the trace config.

```protobuf
data_sources: {
    config {
        name: "linux.sys_stats"
        sys_stats_config {
            meminfo_period_ms: 1000
            meminfo_counters: MEMINFO_MEM_TOTAL
            meminfo_counters: MEMINFO_MEM_FREE
            meminfo_counters: MEMINFO_MEM_AVAILABLE
            vmstat_period_ms: 1000
            vmstat_counters: VMSTAT_NR_FREE_PAGES
            vmstat_counters: VMSTAT_NR_ALLOC_BATCH
            vmstat_counters: VMSTAT_NR_INACTIVE_ANON
            vmstat_counters: VMSTAT_NR_ACTIVE_ANON
            stat_period_ms: 2500
            stat_counters: STAT_CPU_TIMES
            stat_counters: STAT_FORK_COUNT
        }
    }
}
```

All system counters can be seen in [sys\_stats\_counters.proto](/protos/perfetto/common/sys_stats_counters.proto).

When investigating a trace using the `trace_processor`, the counters can be found in the [`counter_track`](/docs/reference/sql-tables.md#counter_track) table.

TODO: Add example query

## Per-process stats

The process stats data source allows you to associate process names with the threads in the trace and collect per process data from `proc/<pid>/status` and `/proc/<pid>/oom_score_adj`.

![](/docs/images/proc_stat.png)

Process names are collected in the trace whenever a new thread is seen in a CPU scheduling event. To ensure thread/process association occurs even in traces with no scheduling data it is advisable to include `scan_all_processes_on_start = true` in your process stats config.

To collect process stat counters at every X ms set `proc_stats_poll_ms = X` in your process stats config. X must be greater than 100ms to avoid excessive CPU usage. Details about the specific counters being collected can be found in [process_stats.proto](/protos/perfetto/trace/ps/process_stats.proto).

Example config: 

```protobuf
data_sources: {
    config {
        name: "linux.process_stats"
        process_stats_config {
            scan_all_processes_on_start: true
            proc_stats_poll_ms: 1000
        }
    }
}
```

For more configuration options see [process_stats_config.proto](/protos/perfetto/config/process_stats/process_stats_config.proto). See [process_stats.proto](/protos/perfetto/trace/ps/process_stats.proto) and [process_tree.proto](/protos/perfetto/trace/ps/process_tree.proto) for more detailed information about all the information that can be collected.

The process/thread associations end up in the process and thread tables in the trace processor.
Run the following query to see them:

``` sql
select * from thread join process using(upid)
```

To investigate the per process counters using the `trace_processor` (rather than the UI as in the screenshot above) use the [process_counter_track](/docs/reference/sql-tables.md#process_counter_track). table.

TODO: Add example query for proc stat counters