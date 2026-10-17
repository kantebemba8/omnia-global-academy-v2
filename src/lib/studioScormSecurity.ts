/** Do not trust progress/completion messages from another browser window. */
export function isTrustedScormMessage(
  event: Pick<MessageEvent, 'source' | 'origin'>,
  frameWindow: MessageEventSource | null | undefined,
  launchUrl: string,
  locationOrigin: string,
): boolean {
  if (!frameWindow || event.source !== frameWindow) return false;
  try {
    const origin = new URL(launchUrl, locationOrigin).origin;
    return origin !== 'null' && event.origin === origin;
  } catch {
    return false;
  }
}
