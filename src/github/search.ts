import fuzzysort from "fuzzysort"
import type { GitHubIssue } from "./issues"

interface SearchableGitHubIssue {
  issue: GitHubIssue
  index: number
  updatedAtMs: number
  titleText: string
  labelsText: string
  peopleText: string
  bodyText: string
}

const TITLE_WEIGHT = 1.5
const LABELS_WEIGHT = 1.25
const PEOPLE_WEIGHT = 1.2
const BODY_WEIGHT = 1
const MULTI_FIELD_BONUS = 0.02

/**
 * Apply local fuzzy filtering and ranking to GitHub issues.
 */
export function searchGitHubIssues(issues: GitHubIssue[], query: string): GitHubIssue[] {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length === 0) {
    return issues.slice()
  }

  const searchableIssues = issues.map((issue, index) => ({
    issue,
    index,
    updatedAtMs: getUpdatedAtMs(issue.updatedAt),
    titleText: issue.title,
    labelsText: issue.labels.map((label) => label.name).join(" "),
    peopleText: getPeopleSearchText(issue),
    bodyText: issue.body ?? "",
  }))

  const matches = fuzzysort.go(trimmedQuery, searchableIssues, {
    keys: ["titleText", "labelsText", "peopleText", "bodyText"],
    scoreFn: (results) => scoreIssueMatch(results),
  })

  return Array.from(matches)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.obj.updatedAtMs !== left.obj.updatedAtMs) {
        return right.obj.updatedAtMs - left.obj.updatedAtMs
      }

      return left.obj.index - right.obj.index
    })
    .map((match) => match.obj.issue)
}

function getPeopleSearchText(issue: GitHubIssue): string {
  const people = [
    issue.author?.login,
    ...issue.assignees.map((assignee) => assignee.login),
  ].filter((value): value is string => Boolean(value))

  return people.join(" ")
}

function getUpdatedAtMs(updatedAt: string): number {
  const parsed = Date.parse(updatedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

function scoreIssueMatch(results: ReadonlyArray<{ score: number }>): number {
  const titleScore = results[0]?.score ?? 0
  const labelsScore = results[1]?.score ?? 0
  const peopleScore = results[2]?.score ?? 0
  const bodyScore = results[3]?.score ?? 0

  const matchedFieldCount = [titleScore, labelsScore, peopleScore, bodyScore].filter((score) => score > 0).length

  return (
    titleScore * TITLE_WEIGHT +
    labelsScore * LABELS_WEIGHT +
    peopleScore * PEOPLE_WEIGHT +
    bodyScore * BODY_WEIGHT +
    matchedFieldCount * MULTI_FIELD_BONUS
  )
}
