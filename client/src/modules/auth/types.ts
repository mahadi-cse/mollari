export interface UserProfile {
  id: string | number;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string; // ready for image support
  role?: string;
  userType?: {
    code: string;
    name: string;
  };
}
