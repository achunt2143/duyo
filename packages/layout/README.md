# @duyo/layout

Enyo's Fittable layout for Duyo, resolved as flexbox.

```ts
{
  kind: 'duyo.FittableRows',
  gap: 'md',
  padding: 'md',
  components: [
    { content: 'Toolbar' },
    { content: 'Takes the rest', fit: true },
  ],
}
```

| Property | |
| --- | --- |
| `fit` | On a child: takes the remaining space. |
| `gap`, `padding` | `'none'`, `'xs'`, `'sm'`, `'md'`, `'lg'`, `'xl'`, from the theme's spacing variables. |
| `align`, `justify` | Cross-axis and main-axis alignment. |
| `fill` | The container fills its parent. |
| `noStretch` | Children keep their own size across the axis. |

The resolver (`resolveFittable`) is pure, so any renderer can use it; `@duyo/react` does.

Apache-2.0.
