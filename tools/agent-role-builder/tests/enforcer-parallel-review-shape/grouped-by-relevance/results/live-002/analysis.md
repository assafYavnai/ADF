# Analysis

- Scenario: grouped-by-relevance
- Run id: live-002
- Wall clock ms: 139930
- Time to first useful finding ms: 44068
- Tester count: 5
- Tester failures: 0
- Findings: 20
- Cost USD: 0.187395

## Top Findings
- [blocking] ARB-016: There is no single authoritative artifact matrix defining artifact class, canonical path/root, and exact lifecycle behavior across operations and terminal states.
- [major] ARB-001: The authority model uses a flat superior list and mixes reference documents into operative authority instead of declaring a precedence chain.
- [major] ARB-017: The role restates local review and freeze behavior without deriving that order and semantics from explicit shared governing sources.
- [major] ARB-019: The artifact describes writes and promotions, but it never declares an explicit governed write boundary rooted in the active runtime contract.
- [major] ARB-020: The durable authority chain includes static reference documents as superiors and does not separate operative authority from reference evidence.
- [major] ARB-021: The role package includes multiple governance mechanics that are not tied back to the declared authority set or inherited contracts.
- [major] ARB-024: The role does not declare the component-local governance files it depends on and does not identify inherited runtime obligations by reference.
- [major] ARB-025: The required inputs section omits external prerequisites that the workflow depends on, including board composition and governance/runtime configuration.
- [major] ARB-006: The markdown `<scope>` exclusion list does not exactly match the contract `out_of_scope` list and includes extra undeduplicated exclusions.
- [major] ARB-002: The freeze threshold uses the term "material pushback" but never defines that concept canonically.

## Failed Tasks