interface DefinitionNode {
  name: string;
  text: string;
  attributes: Array<{ name: string; value: string }>;
  children: DefinitionNode[];
}

function node(name: string, attributes: Record<string, string>,
  children: DefinitionNode[] = []): DefinitionNode {
  return { name, text: "", attributes: Object.entries(attributes)
    .map(([name, value]) => ({ name, value })), children };
}

/** Add the browser presentation option in the unused middle graphics column. */
export function addGraphicsPresentationOptions(definition: DefinitionNode): DefinitionNode {
  if (definition.attributes.some(attribute =>
    attribute.name === "name" && attribute.value === "graphic")) {
    if (definition.children.some(child => child.attributes.some(attribute =>
      attribute.name === "name" && attribute.value === "verticalSyncCont"))) return definition;
    return { ...definition, children: [...definition.children,
      node("Container", { name: "verticalSyncCont", windowSize: "210 20",
        adjust: "295 136" }, [
        node("PlaneCheckButton", { name: "verticalSync", windowSize: "20 20",
          align: "vcenter", enable: "true" }),
        node("Label", { windowRect: "30 0 180 20", align: "vcenter",
          text: "垂直同步（比赛）", textAlign: "left", textRender: "bold16" }),
      ]),
    ] };
  }
  const children = definition.children.map(addGraphicsPresentationOptions);
  // Button styles are keyed by the original resource node's identity.
  return children.some((child, index) => child !== definition.children[index])
    ? { ...definition, children } : definition;
}
