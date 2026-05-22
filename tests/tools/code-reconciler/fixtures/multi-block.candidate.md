# Multi-block trusted document

Intro paragraph that should be left untouched.

~~~ts
export function add(left: number, right: number): number {
  return left + right;
}
~~~

Some prose between two blocks.

```py
def greet(name: str) -> str:
    return f"hello, {name}"
```

A normalized-only difference target follows.

```sh
echo "trusted"   
```

End of trusted document.

```js
console.log("only in candidate");
```
