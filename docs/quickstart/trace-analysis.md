# Quickstart: Trace Analysis

_This quickstart will give some example SQL queries showing how to retrieve data from the trace processor._

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

## Next steps

TODO: link to trace processor documentation and reference
