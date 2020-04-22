# Investigating Memory Usage on Android

## Prerequsities
This tutorial assumes you are running Android 10 or newer on your phone, and
Linux or macOS on your computer. For Java dumps, your phone needs to be
running Android 11 or newer. If you are profiling your own app,
it needs to be marked as profileable or debuggable in its manifest.

To mark an app as profileable, put `<profileable android:shell="true"/>` into
the `<application>`.

```
<manifest ...>
    <application>
        <profileable android:shell="true"/>
        ...
    </application>
</manifest>
```

## dumpsys meminfo
A good place to get started investigating memory usage of a process is
`dumpsys meminfo` which gives a high-level overview of how much of the various
types of memory are being used by a process.

```
$ adb shell dumpsys meminfo com.android.systemui

Applications Memory Usage (in Kilobytes):
Uptime: 2030149 Realtime: 2030149

** MEMINFO in pid 1974 [com.android.systemui] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------   ------
  Native Heap    16840    16804        0     6764    19428    34024    25037     5553
  Dalvik Heap     9110     9032        0      136    13164    36444     9111    27333

[more stuff...]
```

Looking at the "Private Dirty" column of Dalvik Heap (= Java Heap) and
Native Heap, we can see that SystemUI's memory usage on the Java heap
is 9M, on the native heap it's 17M. If you are running this on your own app and
one of those clearly stands out, you might want to start with either
[Analyzing the Native Heap](#analyzing-the-native-heap) or
[Analyzing the Java Heap](#analyzing-the-java-heap) below.

## Analyzing the Native Heap
**Native Heap Profiles require Android 10.**

_If your native memory is neglibile, you can skip ahead to
[Analyzing the Java Heap](#analyzing-the-java-heap)._

We can log the native allocations and frees that a process does using
*heapprofd*. The resulting profile can be used to attribute memory usage
to particular function callstacks, supporting a mix of both native and Java
code. The profile *will only show allocations done while it was running*, any
allocations done before will not be shown.

### Capturing the profile
Use the `tools/heap_profile` script to profile a process. If you are having
trouble make sure you are using the [latest version](
https://raw.githubusercontent.com/google/perfetto/master/tools/heap_profile).
See all the arguments using `tools/heap_profile -h`, or use the defaults
and just profile a process (e.g. `com.android.systemui`):

```
$ tools/heap_profile -n com.android.systemui

Profiling active. Press Ctrl+C to terminate.
You may disconnect your device.

Wrote profiles to /tmp/profile-1283e247-2170-4f92-8181-683763e17445 (symlink /tmp/heap_profile-latest)
These can be viewed using pprof. Googlers: head to pprof/ and upload them.
```

When you see *Profiling active*, play around with the phone a bit. When you
are done, press Ctrl-C to end the profile.

### Viewing the data

Then upload the `raw-trace` file from the output directory to the
[Perfetto UI](https://ui.perfetto.dev) and click on diamond marker that
shows.

![](images/profile-diamond.png)

The default view will show you all allocations that were done while the
profile was running but that weren't freed. This is what the "space" tab
means.

![](images/native-flamegraph.png)

The tabs that are available are

* **space**: how many bytes were allocated but not freed at this callstack the
  moment the dump was created.
* **alloc\_space**: how many bytes were allocated (including ones freed at the
  moment of the dump) at this callstack
* **objects**: how many allocations without matching frees were sampled at this
  callstack.
* **alloc\_objects**: how many allocations (including ones with matching frees)
  were sampled at this callstack.

If we want to only see callstacks that have a frame toat contains some string,
we can use the Focus feature. If we want to know all allocations that have to
do with notifications, we can put "notification" in the Focus box.

![](images/native-flamegraph-focus.png)

## Analyzing the Java Heap
**Java Heap Dumps require Android 11.**

### Capturing the profile
We can get a snapshot of the graph of all the Java objects that constitute the
Java heap. We use the `tools/java_heap_dump` script.If you are having trouble
make sure you are using the [latest version](
https://raw.githubusercontent.com/google/perfetto/master/tools/java_heap_dump).

```
$ tools/java_heap_dump -n com.android.systemui

Dumping Java Heap.
Wrote profile to /tmp/tmpup3QrQprofile
This can be viewed using https://ui.perfetto.dev.
```

### Viewing the Data
Upload the trace to the [Perfetto UI](https://ui.perfetto.dev) and click on
diamond marker that shows.

![](images/profile-diamond.png)

This will present a flamegraph of the memory attributed to the shortest path
to a garbage-collection root. In general an object is reachable by many paths,
we only show the shortest as that reduces the complexity of the data displayed
and is generally the highest-signal. The rightmost `[merged]` stacks is the
sum of all objects that are too small to be displayed.

![](images/java-flamegraph.png)

The tabs that are available are

* **space**: how many bytes are retained via this path to the GC root.
* **objects**: how many objects are retained via this path to the GC root.

If we want to only see callstacks that have a frame toat contains some string,
we can use the Focus feature. If we want to know all allocations that have to
do with notifications, we can put "notification" in the Focus box.



As for native heap profiles, if we want to focus on some specific aspect of the
graph, we can filter by the names of the classes. If we wanted to see everything
that could be caused by notifications, we can put "notification" in the Focus box.

![](images/java-flamegraph-focus.png)

We aggregate the paths per class name, so if there are multiple objects of the
same type retained by a `java.lang.Object[]`, we will show one element as its
child, as you can see in the leftmost stack above.

### Deobfuscation
Many Java apps obfuscate their class, method and field names to reduce APK
size. This will make the resulting Heap Graphs impossible to read, as you
cannot match the obfuscated names back to the source code.

TODO(fmayer): Document deobfuscation.
