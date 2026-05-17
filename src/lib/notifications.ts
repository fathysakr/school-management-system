import db from '@/lib/database';

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: 'urgent' | 'info' | 'warning' = 'info',
  link?: string
) {
  try {
    await db.prepare(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, title, message, type, link || null);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export async function notifyUsers(
  userEmails: string[],
  title: string,
  message: string,
  type: 'urgent' | 'info' | 'warning' = 'info',
  link?: string
) {
  for (const email of userEmails) {
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
    if (user) {
      await createNotification(user.id, title, message, type, link);
    }
  }
}
