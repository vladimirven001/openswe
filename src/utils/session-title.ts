import type { Session } from "../store/types"

export function getStableSessionTitle(session: Session): string {
	return `openswe:${session.id}`
}
