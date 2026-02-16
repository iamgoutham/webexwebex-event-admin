import { prisma } from "@/lib/prisma";
import type { NotificationTemplate } from "@prisma/client";
import type { TemplateVariables, RenderedNotification } from "./types";

// ---------------------------------------------------------------------------
// In-memory cache for templates (cleared on process restart)
// ---------------------------------------------------------------------------

const templateCache = new Map<string, NotificationTemplate>();

/**
 * Fetch a notification template by slug.
 * Results are cached in memory for the lifetime of the process.
 */
export async function getTemplate(
  slug: string,
): Promise<NotificationTemplate | null> {
  const cached = templateCache.get(slug);
  if (cached) return cached;

  const template = await prisma.notificationTemplate.findUnique({
    where: { slug },
  });

  if (template) {
    templateCache.set(slug, template);
  }

  return template;
}

/**
 * Invalidate a cached template (useful after admin edits a template).
 */
export function invalidateTemplateCache(slug?: string): void {
  if (slug) {
    templateCache.delete(slug);
  } else {
    templateCache.clear();
  }
}

/**
 * Render a template by interpolating {{variable}} placeholders.
 *
 * Supports:
 *   - `{{variableName}}` — replaced with the value from `variables`
 *   - Missing variables are replaced with an empty string
 *
 * Example:
 *   renderTemplate("Hello {{name}}, event at {{time}}", { name: "John", time: "3pm" })
 *   → "Hello John, event at 3pm"
 */
export function renderTemplate(
  text: string,
  variables: TemplateVariables,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/**
 * Fetch a template by slug and render it with the given variables.
 * Returns null if the template doesn't exist.
 */
export async function renderNotification(
  slug: string,
  variables: TemplateVariables = {},
): Promise<(RenderedNotification & { template: NotificationTemplate }) | null> {
  const template = await getTemplate(slug);
  if (!template) return null;

  return {
    title: renderTemplate(template.title, variables),
    body: renderTemplate(template.body, variables),
    template,
  };
}
