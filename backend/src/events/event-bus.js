const silentLogger = { error() {} };

// A tiny in-process event bus. It exists so a service can announce a fact
// ("a user was deleted") without knowing who cares about it, which keeps the
// users code free of any declaration or matching code.
//
// Limits, on purpose: it lives in this process only and keeps nothing. If the
// server stops between the change and the event, the event is lost. A durable
// outbox can replace it later without changing the services that emit.
export function createEventBus({ logger = silentLogger } = {}) {
  const handlersByEvent = new Map();

  return {
    // Returns a function that removes the handler again.
    on(event, handler) {
      if (typeof handler !== 'function') {
        throw new TypeError('eventBus.on(): handler must be a function');
      }
      const handlers = handlersByEvent.get(event) ?? [];
      handlersByEvent.set(event, [...handlers, handler]);

      return () => {
        const remaining = (handlersByEvent.get(event) ?? []).filter((h) => h !== handler);
        handlersByEvent.set(event, remaining);
      };
    },

    // Resolves once every handler is done, and NEVER rejects: the change that
    // caused the event has already happened, so a broken listener must not
    // turn it into an error, and one broken listener must not stop the others.
    async emit(event, payload) {
      const handlers = handlersByEvent.get(event) ?? [];

      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(payload);
          } catch (err) {
            logger.error({ err, event }, 'Event handler failed');
          }
        }),
      );
    },
  };
}
