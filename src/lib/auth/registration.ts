// WHY: self sign-up gives any visitor a viewer account, which can watch the live cameras. It stays closed
// unless the operator opts in with ALLOW_SELF_REGISTER=1; admins create accounts from /admin/users.
export const registrationOpen = (): boolean => process.env.ALLOW_SELF_REGISTER === "1";
