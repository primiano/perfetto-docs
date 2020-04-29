# Embedding Perfetto

------

## Trace Processor

### Annotations

The `DescribeSlice` function is exposed to SQL through the `describe_slice` table. This table has the following schema:

| Name        | Type   | Meaning                                                      |
| :---------- | ------ | ------------------------------------------------------------ |
| description | string | Provides the description for the given slice                 |
| doc_link    | string | Provides a hyperlink to documentation which gives more context for the slice |

The table also has a hidden column `slice_id` which needs to be set equal to the id of the slice for which to get the description. For example, to get the description and doc link for slice with id `5`:

```sql
select description, doc_link
from describe_slice
where slice_id = 5
```

The `describe_slice` table can also be _joined_ with the slice table to obtain descriptions for more than one slice. For example, to get the `ts`, `dur` and `description` for all `measure` slices:

```sql
select ts, dur, description
from slice s
join desribe_slice d on s.id = d.slice_id
where name = 'measure'
```

### Creating derived events

As creating derived events is tied to the metrics subsystem, the `ComputeMetrics` function in the trace processor API should be called with the appropriate metrics. This will create the `<metric_name>_annotations` table/view which can then be queried using the `ExectueQuery` function.

NOTE: We plan at some point to have an API which does not create and return the full metrics proto but instead just executes the queries in the metric.

## 