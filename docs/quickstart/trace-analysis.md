# Quickstart: Trace Analysis

This quickstart will give some example SQL queries showing how to retrieve data
from the trace processor. Screenshots from the
[Perfetto UI](https://ui.perfetto.dev) is used to visualise how the data would
look graphically.

### Prerequistes

- A device running macOS/Linux
- [trace processor]() standalone binary should be downloaded and executable.
  _Note: this script requries Python and downloads the correct binary based on
  your platform._
- A trace file in a [supported format](). [This trace]() is used throughout this
  guide.

### Starting trace processor

To begin, start an interactive prompt for SQL queries

```console
$ ./trace_processor trace.pftrace
```

### Threads and processes

Threads and processes are each given their own table and uniquely identified by
the `utid` and `upid` columns respectively; `tids` and `pids` cannot be used
directly as they can be reused over the course of a trace. For more details on
this, see the trace processor
[table documentation](/docs/analysis/trace-processor.md).

![](/docs/images/threads-processes.png)

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

A common task is to look for a specific thread and its assocated proces. For
example, looking for the `android.fg` thread from the `system_server` process

```console
> SELECT tid, thread.name as thread_name, pid, process.name as process_name FROM thread JOIN process USING (upid) WHERE thread_name = 'android.fg' AND process_name = 'system_server'
tid                  thread_name          pid                  process_name
-------------------- -------------------- -------------------- --------------------
                1313 android.fg                           1282 system_server
```

### Tracks

Tracks allow grouping all events which have the same context onto a single
timeline. Every track has a `name` and `id` and they form the backbone of the
Perfetto UI.

![](/docs/images/tracks.png)

```console
> SELECT id, name FROM track
id                   name
-------------------- --------------------
                   0 cpuidle
                   1 cpuidle
                   2 cpuidle
...
                  13 mem.virt
                  14 mem.rss
...
                  21 oom_score_adj
```

### Slices

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

### Counters

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

### Combining tracks with slices/counters

Tracks can come in many varieties (thread tracks, process tracks, CPU counter
tracks etc) and each of these have their own table.

Using the `track_id` column, these tables can be joined with the `slice` and
`counter` tables to obtain the slices or counters for a single track. This is
most useful when the track tables are further joined with other metadata tables
(e.g. the `thread` and `process` tables).

For example, we can obtain all the app slices for the GoogleCamera process

![](/docs/images/camera-slices.png)

```console
> SELECT ts, dur, slice.name FROM slice JOIN thread_track ON thread_track.id = slice.track_id JOIN thread USING (utid) WHERE thread.name = 'id.GoogleCamera'
ts                   dur                  name
-------------------- -------------------- --------------------
     261195282509319                82448 disconnect
     261195301397967                63177 query
     261195301463279                42605 query
     261195301528800                37761 query
     261196464210635                17916 unlockAsync
...
```

For more information on the types of tracks and how to combine them with the
`slice` and `counter` tables, see the
[trace processor documentation](/docs/analysis/trace-processor.md)

### Scheduling slices

Scheduling slices are slices which indicate which thread was scheduled on which
CPU at which time.

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

SQL joins can be used to obtain more information about the running thread and
process in each slice.

```console
> SELECT ts, dur, cpu, tid, thread.name AS thread_name, pid, process.name AS process_name FROM sched JOIN thread USING (utid) JOIN process USING (upid) ORDER BY ts
ts                   dur                  cpu                  tid                  thread_name          pid                  process_name
-------------------- -------------------- -------------------- -------------------- -------------------- -------------------- --------------------
     261187012170995               247188                    2                  627 logd.klogd                            600 /system/bin/logd
     261187012418183                12812                    2                20614 traced_probes0                      25434 /system/bin/traced_p
     261187012421099               220000                    4                12428 kworker/u16:2                           2 kthreadd
...
```

### Next steps

TODO(lalitm): link to trace processor documentation and reference
