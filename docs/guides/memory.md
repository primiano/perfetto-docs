# Investigating Memory Usage on Android

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

[SNAP]
```

Looking at the "Private Dirty" column of Dalvik Heap (= Java Heap) and
Native Heap, we can see that SystemUI's memory usage on the Java heap
is 9M, on the native heap it's 17M.

## Analyzing Java Heap
We can get a snapshot of the graph of all the Java objects that constitute the
Java heap. We use the `tools/java_heap_dump` script.

```
$ tools/java_heap_dump -n com.android.systemui

Dumping Java Heap.
Wrote profile to /tmp/tmpup3QrQprofile
This can be viewed using https://ui.perfetto.dev.
```

Upload the trace to the [Perfetto UI](https://ui.perfetto.dev) and click on
diamond marker that shows.

![](images/profile-diamond.png)

This will present a flamegraph of the memory attributed to the shortest path
to a garbage-collection root. In general an object is reachable by many paths,
we only show the shortest as that reduces the complexity of the data displayed
and is generally the highest-signal.

![](images/java-flamegraph.png)

We aggregate the paths per class name, so if there are two `Foo` objects that
each retain a `String`, we will show one element for `String` as a child of
one `Foo`.
