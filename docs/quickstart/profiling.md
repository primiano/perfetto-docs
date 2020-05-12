# Heap Profiling Quickstart

## Prerequisites
* A host running macOS or Linux.
* A device running Android 10+.

If you are profiling your own app and are not running a userdebug build of
Android, your app needs to be marked as profileable or
debuggable in its manifest. See the [heapprofd documentation](
/docs/data-sources/native-heap-profiler.md#heapprofd-targets) for more
details on which applications can be targeted.

## Get a profile

Download and run the [`tools/heap_profile`](
https://raw.githubusercontent.com/google/perfetto/master/tools/heap_profile)
script.

```
$ tools/heap_profile -n system_server

Profiling active. Press Ctrl+C to terminate.
You may disconnect your device.

Wrote profiles to /tmp/profile-1283e247-2170-4f92-8181-683763e17445 (symlink /tmp/heap_profile-latest)
These can be viewed using pprof. Googlers: head to pprof/ and upload them.
```

## View profile
Upload the `raw-trace` file from the output directory to the [Perfetto UI](
https://ui.perfetto.dev) and click on diamond marker that shows.

![Profile Diamond](/docs/images/profile-diamond.png)
![Native Flamegraph](/docs/images/syssrv-apk-assets-two.png)

## Next steps
Learn more about memory debugging in the [Memory Usage on Android Guide](
/docs/case-studies/memory.md) and more about the [heapprofd data-source](
/docs/TODO.md).
