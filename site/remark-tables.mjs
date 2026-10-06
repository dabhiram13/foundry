export default function focusableTables() {
  return (tree) => {
    function walk(node) {
      if (node.type === 'table') {
        node.data ??= {};
        node.data.hProperties = { ...node.data.hProperties, tabIndex: 0 };
      }
      for (const child of node.children ?? []) walk(child);
    }
    walk(tree);
  };
}
