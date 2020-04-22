# Trace Processor

_**TLDR**: The Trace Processor is a C++ library
([/src/trace_processor](https://android.googlesource.com/platform/external/perfetto/+/master/src/trace_processor))
that ingests traces encoded in a wide variety of formats and allows SQL queries
on trace events contained in a consistent set of tables. It also has other
features including computation of summary metrics, annotating the trace with new
events and deriving new events from the contents of the trace._

## Introduction

Traces are raw and optimized for fast & low overhead writing. This leads to
encoding of events in a format that make it difficult to extract useful
information. This is compounded by the amount of legacy formats which are still
in use and need to be supported in trace analysis tools. The trace processor
abstracts this complexity by parsing traces, extracting the data inside and
exposing it as database tables which can be queried with SQL.

Features of the trace processor include:

- Execution of SQL queries on a custom, in-memory, columnar database backed by
  SQLite
- Metrics subsystem which allows computation of summarised view of the trace
  (e.g. CPU or memory usage of a process, time taken for app startup etc.).
- Annotationing events in the trace with user-friendly descriptions providing
  context and explanation of events to newer users
- Creation of new events derived from the contents of the trace

The formats supported by trace processor include:

- Perfetto's native protobuf format
- Android's systrace
- Linux's ftrace
- Chrome's JSON (including with embedded Android traces)
- Fuchsia binary format
- Ninja logs

The trace processor is embedded in a wide variety of trace analysis tools
including:

- trace_processor, a standalone binary and the reference embedder of the library
- Perfetto UI, in the form of a WebAssembly module
- Android Graphics Inspector
- Android Studio
- Internal pipelines for batch processing

## Quickstart

<TODO link to trace analysis quickstart>

## Tables

_For a comprehensive reference of all the available tables and their columns,
see <TODO>._

As noted in the [introduction to trace analysis](analysis/index.md), slices,
counters and tracks are core concepts to analysing traces. The trace processor
exposes these as tables which can be queried using SQL.

For example, all counter events in the trace are in the `counter` table. For
example, to obtain the first 10 counter events in the trace

```sql
SELECT * FROM counter ORDER BY ts LIMIT 10
```

Similarily, slices are located in the `slice` table

```sql
SELECT * FROM slice ORDER BY ts LIMIT 10
```

As tracks come in many types, this is reflected in their structure in trace
processor. Every type of track has its own table and they form a
"object-oriented" heirarchy of tables.

<TODO diagram>

Note how every column in the parent tables is also present in the child tables.
Moreover, every row in child tables is also present in the parent tables and has
the same `id`.

For example, all the CPU counter tracks can be found in the `cpu_counter_track`
table

```sql
SELECT * FROM cpu_counter_track ORDER BY ts LIMIT 10
```

Note how the `slice` and `counter` tables only contain the information which is
unique to that event. Any information which is shared by all events in a track
are located in the track tables. The `track_id` column present on both of these
tables acts as an SQL foreign key to the track tables.

We can recover the context for the events in the `slice` or `counter` tables by
performing an SQL join. For example, we can obtain the CPU for a CPU counter
events

```sql
SELECT ts, cpu, value
FROM counter
JOIN cpu_counter_track ON counter.track_id = cpu_counter_track.id
LIMIT 10
ORDER BY ts
```

This query returns just the rows in the `counter` table which are associated to
a CPU.
