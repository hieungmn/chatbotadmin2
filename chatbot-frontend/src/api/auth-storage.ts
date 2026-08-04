export function clearAdminAuth(storage: Pick<Storage, 'removeItem'>): void {
    for (const key of ['admin_token', 'token', 'username', 'full_name', 'user_role']) {
        storage.removeItem(key);
    }
}
