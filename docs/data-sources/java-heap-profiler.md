# Memory: Java heap graphs

NOTE: **Java Heap Graphs require Android 11.**

## Quickstart
See the [Memory Guide](/docs/case-studies/memory.md#java-hprof) for getting
started with Java Heap Graphs.

## UI

Java Dumps are shown as flamegraphs in the UI after clicking on the
diamond.

![](/docs/images/profile-diamond.png)

![](/docs/images/java-flamegraph.png)

## Trace Processor
Information about the Java Heap is written to the following tables:
* [`heap_graph_class`](/docs/analysis/sql-tables.autogen#heap_graph_class)
* [`heap_graph_object`](/docs/analysis/sql-tables.autogen#heap_graph_object)
* [`heap_graph_reference`](/docs/analysis/sql-tables.autogen#heap_graph_reference)

For instance, to get the bytes used by class name, run the following query.
This will usually be very generic, as most of the bytes in Java objects will
be in primitive arrays or Strings.

```sql
> select c.name, sum(o.self_size)
         from heap_graph_object o join
         heap_graph_class c on (o.type_id = c.id)
         where reachable = 1 group by 1 order by 2 desc;
```

|name                |sum(o.self_size)    |
|--------------------|--------------------|
|java.lang.String    |             2770504|
|long[]              |             1500048|
|int[]               |             1181164|
|java.lang.Object[]  |              624812|
|char[]              |              357720|
|byte[]              |              350423|

We can use `experimental_flamegraph` to normalize the graph into a tree, always
taking the shortest path to the root and get cumulative sizes.
Note that this is **experimental** and the **API is subject to change**, so
only use that for one-offs. From this we can see how much memory is being
hold on by objects of a type.

```sql
> select name, cumulative_size
  from experimental_flamegraph(56785646801, 1, 'graph')
  order by 2 desc;
```

| name | cumulative_size |
|------|-----------------|
|java.lang.String|1431688|
|java.lang.Class<android.icu.text.Transliterator>|1120227|
|android.icu.text.TransliteratorRegistry|1119600|
|com.android.systemui.statusbar.phone.StatusBarNotificationPresenter$2|1086209|
|com.android.systemui.statusbar.phone.StatusBarNotificationPresenter|1085593|
|java.util.Collections$SynchronizedMap|1063376|
|java.util.HashMap|1063292|