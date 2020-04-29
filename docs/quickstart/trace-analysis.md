# Quickstart: Trace Analysis

-------

_**TLDR**: This quickstart will give some example SQL queries showing how to retrieve data from the trace processor._

## Prerequistes

- A device running macOS/Linux
- A trace file in a [supported format](). [This trace]() is used throughout this guide.

## Setup

To begin, download the trace processor [here](). (_Note: this script requries Python and downloads the correct native binary based on your platform._)

Then, start an interactive prompt for SQL queries

```console
$ chmod +x ./trace_processor       # ensures that trace processor is executable 
$ ./trace_processor trace.pftrace
```

## Slices

Slices are events which have name and span some duration of time.

![](/docs/images/slices.png)

```console
> SELECT ts, dur, name FROM slice
ts                   dur                  name
-------------------- -------------------- --------------------
     261187017446933                44323 requestNextVsync
     261187020818340               358594 onMessageReceived
     261187020825163                 9948 wait
     ...
```

## Counters

Counters are events with a value which changes over time.

![](/docs/images/counters.png)

```console
> SELECT ts, value FROM counter
ts                   value
-------------------- --------------------
     261187012149954    4294967295.000000
     261187012399172    4294967295.000000
     261187012447402    4294967295.000000
     261187012535839             0.000000
...
```

## Scheduling slices

Scheduling slices are slices which indicate which thread was scheduled on which CPU at which time.

![](/docs/images/sched-slices.png)

```console
> SELECT ts, dur, cpu, utid FROM sched
ts                   dur                  cpu                  utid
-------------------- -------------------- -------------------- --------------------
     261187012170995               247188                    2                  767
     261187012418183                12812                    2                 2790
     261187012421099               220000                    4                  683
     261187012430995                72396                    2                 2791
...
```

## Threads and processes

Threads and processes are each given their own table and uniquely identified by the `utid` and `upid` columns respectively; `tids` and `pids` cannot be used directly as they can be reused over the course of a trace. For more details on this, see the trace processor [table documentation](/docs/analysis/trace-processor.md).

```console
> SELECT utid, tid, name FROM thread
utid                 tid                  name
-------------------- -------------------- --------------------
                   0                    0 swapper/0
                   1                    1 init
                   2                    2 kthreadd
...

> SELECT upid, pid, name FROM process
upid                 pid                  name
-------------------- -------------------- --------------------
                   0                    0 [NULL]
                   1                    1 /system/bin/init
                   2                    2 kthreadd
...
```

A common task is to look for a specific thread and its assocated proces. For example, looking for the `android.fg` thread from the `system_server` process

```console
> SELECT tid, thread.name as thread_name, pid, process.name as process_name FROM thread JOIN process USING (upid) WHERE thread_name = 'android.fg' AND process_name = 'system_server'
tid                  thread_name          pid                  process_name
-------------------- -------------------- -------------------- --------------------
                1313 android.fg                           1282 system_server
```

## Next steps

TODO: link to trace processor documentation and reference
