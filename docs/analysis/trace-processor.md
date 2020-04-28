# Trace Processor

_**TLDR**: The Trace Processor is a C++ library ([/src/trace_processor](/src/trace_processor)) that ingests traces encoded in a wide variety of formats and allows SQL queries on trace events contained in a consistent set of tables. It also has other features including computation of summary metrics, annotating the trace with new events and deriving new events from the contents of the trace._

## Introduction

Traces are raw and optimized for fast & low overhead writing. This leads to encoding of events in a format that make it difficult to extract useful information. This is compounded by the amount of legacy formats which are still in use and need to be supported in trace analysis tools.

The trace processor abstracts this complexity by parsing traces, extracting the data inside and exposing it as database tables which can be queried with SQL.

Features of the trace processor include:

- Execution of SQL queries on a custom, in-memory, columnar database backed by SQLite
- Metrics subsystem which allows computation of summarised view of the trace (e.g. CPU or memory usage of a process, time taken for app startup etc.).
- Annotationing events in the trace with user-friendly descriptions providing context and explanation of events to newer users
- Creation of new events derived from the contents of the trace

The formats supported by trace processor include:

- Perfetto's native protobuf format
- Android's systrace
- Linux's ftrace
- Chrome's JSON (including with embedded Android traces)
- Fuchsia binary format
- Ninja logs

The trace processor is embedded in a wide variety of trace analysis tools including:

- trace_processor, a standalone binary and the reference embedder of the library
- Perfetto UI, in the form of a WebAssembly module
- Android Graphics Inspector
- Android Studio
- Internal pipelines for batch processing

## Quickstart

TODO: link to trace analysis quickstart

## Tables

Before reading this section, it's recommended to read the trace analysis [quickstart](/docs/quickstart/trace-analysis.md) and [introduction](); these cover concepts like events and tracks which are important to understand before reading this section.

### Hierarchies

Modelling an object with many types  is a common problem in trace processor. For example, tracks can come in many varieties (thread tracks, process tracks, counter tracks etc). Each type has a piece of data associated to it unique to that type; for example, thread tracks have a `utid` of the thread, counter tracks have the `unit` of the counter.

To solve this problem in object-oriented languages, a `Track` class could be created and inheritance used for all subclasses (e.g. `ThreadTrack` and `CounterTrack` being subclasses of `Track`, `ProcessCounterTrack` being a subclass of `CounterTrack` etc).

TODO: add a diagram with the hierarchy.

In trace processor, we replicate this "object-oriented" approach in tables of objects with many types. For example, we have a `track` table as the "root" of the heirarchy with the `thread_track` and `counter_track` tables "inheriting from" the `track` table.

TODO: talk about how inheritance works with columns of the tables

TODO: add a diagram with the SQL hierarchy

TODO: talk about efficiency

### Tracks

Tracks allow grouping all events which have the same context onto a single timeline. Every track has a `name` and `id` and they form the backbone of the Perfetto UI.

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

### Combining tracks with slices/counters

Tracks can come in many varieties (thread tracks, process tracks, CPU counter tracks etc) and each of these have their own table.

Using the `track_id` column, these tables can be joined with the `slice` and `counter` tables to obtain the slices or counters for a single track. This is most useful when the track tables are further joined with other metadata tables (e.g. the `thread` and `process` tables).

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

For more information on the types of tracks and how to combine them with the `slice` and `counter` tables, see the [trace processor documentation](/docs/analysis/trace-processor.md)

### Scheduling slices

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

SQL joins can be used to obtain more information about the running thread and process in each slice.

```console
> SELECT ts, dur, cpu, tid, thread.name AS thread_name, pid, process.name AS process_name FROM sched JOIN thread USING (utid) JOIN process USING (upid) ORDER BY ts
ts                   dur                  cpu                  tid                  thread_name          pid                  process_name
-------------------- -------------------- -------------------- -------------------- -------------------- -------------------- --------------------
     261187012170995               247188                    2                  627 logd.klogd                            600 /system/bin/logd
     261187012418183                12812                    2                20614 traced_probes0                      25434 /system/bin/traced_p
     261187012421099               220000                    4                12428 kworker/u16:2                           2 kthreadd
...
```

As noted in the [introduction to trace analysis](/docs/analysis/index.md), slices, counters and tracks are core concepts to analysing traces. The trace processor exposes these as tables which can be queried using SQL.

For example, all counter events in the trace are in the `counter` table. For example, to obtain the first 10 counter events in the trace

```sql
SELECT * FROM counter ORDER BY ts LIMIT 10
```

Similarily, slices are located in the `slice` table

```sql
SELECT * FROM slice ORDER BY ts LIMIT 10
```

As tracks come in many types, this is reflected in their structure in trace processor. Every type of track has its own table and they form a "object-oriented" heirarchy of tables.

TODO: diagram

Note how every column in the parent tables is also present in the child tables. Moreover, every row in child tables is also present in the parent tables and has the same `id`.

For example, all the CPU counter tracks can be found in the `cpu_counter_track` table

```sql
SELECT * FROM cpu_counter_track ORDER BY ts LIMIT 10
```

Note how the `slice` and `counter` tables only contain the information which is unique to that event. Any information which is shared by all events in a track are located in the track tables. The `track_id` column present on both of these tables acts as an SQL foreign key to the track tables.

We can recover the context for the events in the `slice` or `counter` tables by performing an SQL join. For example, we can obtain the CPU for a CPU counter events

```sql
SELECT ts, cpu, value
FROM counter
JOIN cpu_counter_track ON counter.track_id = cpu_counter_track.id
LIMIT 10
ORDER BY ts
```

This query returns just the rows in the `counter` table which are associated to a CPU.