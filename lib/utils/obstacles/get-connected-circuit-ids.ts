import type { ConnectivityMap } from "circuit-json-to-connectivity-map"

// Only export actual circuit IDs. Generated net IDs are local to a map and
// can collide with the router's own generated nets.
export function getConnectedCircuitIds(
  idList: string[],
  connMap?: ConnectivityMap,
) {
  if (!connMap) return idList
  return [
    ...new Set([
      ...idList,
      ...idList.flatMap((id) => {
        const netId = connMap.getNetConnectedToId(id)
        return netId ? connMap.getIdsConnectedToNet(netId) : []
      }),
    ]),
  ]
}
