// Claude compiles strict tool schemas and JSON output schemas into a grammar and refuses requests
// past fixed limits, counted over every strict schema in one request (union = anyOf or a type array).
export const STRICT_LIMITS = { tools: 20, optional: 24, unions: 16 };

export interface SchemaLoad {
  optional: number;
  unions: number;
}

const isUnion = (s: any) => Array.isArray(s?.anyOf) || Array.isArray(s?.oneOf) || Array.isArray(s?.type);

/** Optional and union-typed parameters at any depth of a JSON schema. */
export function schemaLoad(schema: unknown): SchemaLoad {
  const load = { optional: 0, unions: 0 };
  const visit = (s: any) => {
    if (!s || typeof s !== "object") return;
    if (s.properties && typeof s.properties === "object") {
      const required = new Set<string>(Array.isArray(s.required) ? s.required : []);
      for (const [name, prop] of Object.entries<any>(s.properties)) {
        if (!required.has(name)) load.optional++;
        if (isUnion(prop)) load.unions++;
        visit(prop);
      }
    }
    for (const key of ["items", "additionalProperties"]) if (s[key] && typeof s[key] === "object") visit(s[key]);
    for (const key of ["anyOf", "oneOf", "allOf", "prefixItems"]) if (Array.isArray(s[key])) s[key].forEach(visit);
    for (const key of ["$defs", "definitions"]) if (s[key]) Object.values(s[key]).forEach(visit);
  };
  visit(schema);
  return load;
}

export function fitsStrict(load: SchemaLoad): boolean {
  return load.optional <= STRICT_LIMITS.optional && load.unions <= STRICT_LIMITS.unions;
}

/** Which tools can be strict together: in order, while the combined load stays inside the limits. */
export function strictTools(schemas: unknown[]): boolean[] {
  const total = { optional: 0, unions: 0 };
  let count = 0;
  return schemas.map((schema) => {
    const load = schemaLoad(schema);
    const next = { optional: total.optional + load.optional, unions: total.unions + load.unions };
    if (count >= STRICT_LIMITS.tools || !fitsStrict(next)) return false;
    total.optional = next.optional;
    total.unions = next.unions;
    count++;
    return true;
  });
}
