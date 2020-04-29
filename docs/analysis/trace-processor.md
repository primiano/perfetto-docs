# Trace Processor

------

**TLDR**: The Trace Processor is a C++ library ([/src/trace_processor](/src/trace_processor)) that ingests traces encoded in a wide variety of formats and allows SQL queries on trace events contained in a consistent set of tables. It also has other features including computation of summary metrics, annotating the trace with new events and deriving new events from the contents of the trace.

## Quickstart

TODO: link to trace analysis quickstart

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

## Tables

Before reading this section, it's recommended to read the trace analysis [quickstart](/docs/quickstart/trace-analysis.md) and [introduction](); these cover necessary foundational concepts like events and tracks.

### Hierarchies

Modelling an object with many types  is a common problem in trace processor. For example, tracks can come in many varieties (thread tracks, process tracks, counter tracks etc). Each type has a piece of data associated to it unique to that type; for example, thread tracks have a `utid` of the thread, counter tracks have the `unit` of the counter.

To solve this problem in object-oriented languages, a `Track` class could be created and inheritance used for all subclasses (e.g. `ThreadTrack` and `CounterTrack` being subclasses of `Track`, `ProcessCounterTrack` being a subclass of `CounterTrack` etc).

TODO: add a diagram with the hierarchy.

In trace processor,  this "object-oriented" approach is replicated by having different tables for each type of object. For example, we have a `track` table as the "root" of the heirarchy with the `thread_track` and `counter_track` tables "inheriting from" the `track` table.

TODO: add a diagram with the SQL hierarchy

Concretely, inheritance between tables works like so:

* Every row in a table has an `id` which is unique for a hierarchy of tables.
  * For example, every `track` will have an `id` which is unique among all tracks (regardless of the type of track)
* If a table C inherits from P, each row in C will also be in P _with the same id_
  * This allows for ids to act as "pointers" to rows; lookups by id can be performed on any table which has that row
  * For example, every `process_counter_track` row will have a matching row in `counter_track` which will itself have matching rows in `track`
* If a table C with columns `A` and `B` inherits from P with column `A`, `A` will have the same data in both C and P
  * For example, suppose
    *  `process_counter_track` has columns `name`, `unit` and `upid`
    * `counter_track` has `name` and `unit`
    * `track` has `name`
  * Every row in `process_counter_track` will have the same `name`  for the row with the same id in  `track` and `counter_track`
  * Similarily, every row in `process_counter_track` will have both the same `name ` and `unit` for the row with the same id in `counter_track`
* Every row in a table has a `type` column. This specifies the _most specific_ table this row belongs to.
  * This allows _dynamic casting_ of a row to its most specific type
  * For example, for if a row in the `track` is actually a `process_counter_track`, it's type column will be `process_counter_track`

The above rules are best summarised in this diagram.

TODO: add a diagram with the columns in SQL hierarchy

NOTE: To ensure that inheritance is performance efficient, the trace processor does not actually duplicate rows behind the scenes. Instead, it stores data in each row only once in large arrays and uses efficient data structures (e.g. bitvectors) to index into the arrays.

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

## Annotations

TIP: To see how to add to add a new annotation to trace processor, see the checklist [here](/docs/TODO.md)

Annotations attach a human-readable description to a slice in the trace. This can include information like the source of a slice, why a slice is important and links to documentation where the viewer can learn more about the slice. In essence, descriptions act as if an expert was telling the user what the slice means.

For example, consider the `inflate` slice which occurs during view inflation in Android. We can add the following description and link:

```
Description: Constructing a View hierarchy from pre-processed XML via LayoutInflater#layout. This includes constructing all of the View objects in the hierarchy, and applying styled attributes.

Link: https://developer.android.com/reference/android/view/layoutinflater#inflate(int,%20android.view.viewgroup)
```

## Creating derived events

TIP: To see how to add to add a new annotation to trace processor, see the checklist [here]()

This feature allows creation of new events (slices and counters) from the data in the trace. These events can then be displayed in the UI tracks as if they were part of the trace itself.

This is useful as often the data in the trace is very low-level. While low level information is important for experts to perform deep debugging, often users are just looking for a high level overview without needing to consider events from multiple locations.

For example, an app startup in Android spans multiple components including`ActivityManager`, `system_server` and the newly created app process derived from `zygote`. Most users do not need this level of detail; they are only interested in a single slice spanning the entire startup.

Creating derived events is tied very closely to [metrics subsystem](/docs/analysis/metrics.md); often SQL-based metrics need to create higher-level abstractions from raw events as intermediate artifacts. From previous example, the [startup metric](/src/trace_processor/metrics/android/android_startup.sql) creates the exact `launching` slice we want to display in the UI.

The other benefit of aligning the two is that changes in metrics are automatically kept in sync with what the user sees in the UI.

## Alerts

Alerts are used to draw the attention of the user to interesting parts of the trace; this are usually warnings or errors about anomalies which occured in the trace.

Currently, alerts are not implemented in the trace processor but the API to create derived events was designed with them in mind. We plan on adding another column `alert_type` (name to be finalized) to the annotations table which can have the value `warning`, `error` or `null`. Depending on this value, the Perfetto UI will flag these events to the user.

NOTE: we do not plan on supporting case where alerts need to be added to existing events. Instead, new events should be created using annotations and alerts added on these instead; this is because the trace processor storage is append-only.