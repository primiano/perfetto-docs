# Quickstart: Trace Analysis

_This quickstart will give some example SQL queries showing how to retrieve data from the trace processor._

## Prerequistes

- A device running macOS/Linux
- A trace file in a [supported format](/docs/TODO.md). This [trace](/docs/TODO.md) can be used as an example for running the queries in this quickstart.

## Setup

To begin, download the trace processor [here](/docs/TODO.md). (_Note: this script requries Python and downloads the correct native binary based on your platform._)

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
-------------------- -------------------- ---------------------------
     261187017446933               358594 eglSwapBuffersWithDamageKHR
     261187017518340                  357 onMessageReceived
     261187020825163                 9948 queueBuffer
     261187021345235                  642 bufferLoad
     261187121345235                  153 query
     ...
```

## Counters

Counters are events with a value which changes over time.

![](/docs/images/counters.png)

```console
> SELECT ts, value FROM counter
ts                   value
-------------------- --------------------
     261187012149954          1454.000000
     261187012399172          4232.000000
     261187012447402         14304.000000
     261187012535839         15490.000000
     261187012590890         17490.000000
     261187012590890         16590.000000
...
```

## Scheduling slices

Scheduling slices are slices which indicate which thread was scheduled on which CPU at which time.

![](/docs/images/sched-slices.png)

```console
> SELECT ts, dur, cpu, utid FROM sched
ts                   dur                  cpu                  utid
-------------------- -------------------- -------------------- --------------------
     261187012170489               267188                    0                  390
     261187012170995               247153                    1                  767
     261187012418183                12812                    2                 2790
     261187012421099               220000                    6                  683
     261187012430995                72396                    7                 2791
...
```

## Next steps

There are several options for exploring more of the trace analysis features Perfetto provides:

- The [trace processor documentation](/docs/TODO.md) gives more information about how to work with trace processor including details on how to write queries and how tables in trace processor are organized.
- The [trace-based metrics quickstart](/docs/TODO.md) gives an introduction on how to summarise traces into metrics which can be further processed using auotmated tools.
- The [trace conversion quickstart](/docs/TODO.md) gives an overview on how to convert Perfetto traces to legacy formats to integrate with existing tooling.