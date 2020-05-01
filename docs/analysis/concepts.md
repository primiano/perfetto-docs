# Trace Analysis: Concepts

-------

_**TLDR**: this page summarises various concepts which are used throughout trace processor._

## Events

In the most general sense, a trace is simply a collection of "events" on a timeline. Events can have associated metadata and context which allows them to be interpreted and analysed.

Events form the foundation of trace processor and are one of two types: slices and counters.

TODO: add a picture from the UI

A slice refers to an interval of time with some data describing what was happening in that interval. Some example of slices include:

- Scheduling slices for each CPU
- Atrace slices on Android
- Userspace slices from Chrome

TODOL: add a picture from the UI

A counter is a continuous value which varies over time. Some examples of counters include:

- CPU frequency for each CPU core
- RSS memory events - both from the kernel and polled from /proc/stats
- Atrace counter events from Android
- Chrome counter events

## Tracks

A track is a named partition of events of the same type and the same associated context. For example:

- Scheduling slices have one track for each CPU
- Sync userspace slice have one track for each thread which emitted an event
- Async userspace slices have one track for each “cookie” linking a set of async
  events

The most intuitive way to think of a track is to imagine how they would be drawn in a UI; if all the events are in a single row, they belong to the same track. For example, all the scheduling events for CPU 0 are on the same track:

TODO: add a picture from the UI

Tracks can be split into various types based on the type of event they contain and the context they are assocated with. Examples include:

- Global tracks are not assocated to any conrext and contain slices
- Thread tracks are associated to a single thread and contain slices
- Counter tracks are not assocated to any context and contain counters
- CPU counter tracks are associated to a single CPU and contain counters

## Threads and processes

TODO: talk about utids and upids here