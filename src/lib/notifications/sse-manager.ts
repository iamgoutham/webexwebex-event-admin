// ---------------------------------------------------------------------------
// SSE Connection Manager — Singleton
// ---------------------------------------------------------------------------
//
// Manages Server-Sent Events connections for real-time in-app notifications.
// Each authenticated user can have one or more SSE connections (multiple tabs).
//
// Usage:
//   - The stream API route opens a connection via `addConnection(userId, controller)`
//   - When a notification is created for a user, call `pushToUser(userId, event)`
//   - The connection is automatically cleaned up when the client disconnects
// ---------------------------------------------------------------------------

export interface SSENotificationEvent {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  createdAt: string;
}

type SSEConnection = {
  controller: ReadableStreamDefaultController;
  userId: string;
  createdAt: Date;
};

class SSEManager {
  private connections = new Map<string, SSEConnection[]>();

  /**
   * Add a new SSE connection for a user.
   * Returns a cleanup function to call when the connection closes.
   */
  addConnection(
    userId: string,
    controller: ReadableStreamDefaultController,
  ): () => void {
    const conn: SSEConnection = {
      controller,
      userId,
      createdAt: new Date(),
    };

    const existing = this.connections.get(userId) ?? [];
    existing.push(conn);
    this.connections.set(userId, existing);

    console.log(
      `[sse] Connection added for ${userId} (total: ${existing.length})`,
    );

    // Return cleanup function
    return () => {
      const conns = this.connections.get(userId);
      if (conns) {
        const filtered = conns.filter((c) => c !== conn);
        if (filtered.length === 0) {
          this.connections.delete(userId);
        } else {
          this.connections.set(userId, filtered);
        }
      }
      console.log(
        `[sse] Connection removed for ${userId} (remaining: ${this.connections.get(userId)?.length ?? 0})`,
      );
    };
  }

  /**
   * Push a notification event to all connections for a specific user.
   */
  pushToUser(userId: string, event: SSENotificationEvent): void {
    const conns = this.connections.get(userId);
    if (!conns || conns.length === 0) return;

    const data = `data: ${JSON.stringify(event)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);

    const deadConnections: SSEConnection[] = [];

    for (const conn of conns) {
      try {
        conn.controller.enqueue(encoded);
      } catch {
        // Connection is dead
        deadConnections.push(conn);
      }
    }

    // Clean up dead connections
    if (deadConnections.length > 0) {
      const alive = conns.filter((c) => !deadConnections.includes(c));
      if (alive.length === 0) {
        this.connections.delete(userId);
      } else {
        this.connections.set(userId, alive);
      }
    }
  }

  /**
   * Push a notification event to ALL connected users (broadcast).
   */
  pushToAll(event: SSENotificationEvent): void {
    for (const userId of this.connections.keys()) {
      this.pushToUser(userId, event);
    }
  }

  /**
   * Push to all users in a specific tenant.
   * If tenantUserIds is provided, only pushes to those users.
   */
  pushToUsers(userIds: string[], event: SSENotificationEvent): void {
    for (const userId of userIds) {
      this.pushToUser(userId, event);
    }
  }

  /**
   * Get the number of currently connected users.
   */
  getConnectedUserCount(): number {
    return this.connections.size;
  }

  /**
   * Get the total number of active connections (a user can have multiple).
   */
  getTotalConnectionCount(): number {
    let count = 0;
    for (const conns of this.connections.values()) {
      count += conns.length;
    }
    return count;
  }

  /**
   * Check if a specific user has at least one active connection.
   */
  isUserConnected(userId: string): boolean {
    return (this.connections.get(userId)?.length ?? 0) > 0;
  }
}

// Singleton — survives hot reloads in development via globalThis
const globalForSSE = globalThis as unknown as { __sseManager?: SSEManager };

export const sseManager =
  globalForSSE.__sseManager ?? new SSEManager();

if (process.env.NODE_ENV !== "production") {
  globalForSSE.__sseManager = sseManager;
}
