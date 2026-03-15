/**
 * Hard caps for online morgue import. Adjust these to control how many morgues
 * can be fetched in a single run (prevents mass re-downloads for users with many games).
 */

/** Max new morgues to fetch per server in a single run. */
export const MAX_NEW_GAMES_PER_SERVER_PER_RUN = 50

/** Max game metadata rows to consider per server (logfile scan). */
export const MAX_GAMES_PER_SERVER_PER_RUN = 500

/** Max total morgue fetches across all servers in a single run. */
export const MAX_TOTAL_MORGUE_FETCHES_PER_RUN = 100
