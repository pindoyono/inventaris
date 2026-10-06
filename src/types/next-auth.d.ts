import "next-auth";
import "next-auth/jwt";

type Kind = "school" | "platform";

declare module "next-auth" {
  interface User {
    kind: Kind;
    schoolId?: string;
    npsn?: string;
    roles?: string[];
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      kind: Kind;
      schoolId?: string;
      npsn?: string;
      roles: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    kind: Kind;
    schoolId?: string;
    npsn?: string;
    roles?: string[];
  }
}
