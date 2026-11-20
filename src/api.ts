export interface Student {
  id: number;
  studentCode: string;
  prefixId: number;
  prefixName: string;
  firstName: string;
  lastName: string;
  genderId: number;
  genderName: string;
  birthDate: string;
  gradeLevelId: number;
  gradeLevelName: string;
}
export interface Classroom {
  id: number;
  roomNo: string;
  roomName: string;
  academicYear: number;
  gradeLevelId: number;
  gradeLevelName: string;
  homeroomTeacherId: number | null;
  homeroomTeacherName: string | null;
}
export interface Metadata {
  prefixes: { id: number; name: string }[];
  genders: { id: number; code: string; name: string }[];
  gradeLevels: { id: number; code: string; name: string; fullName: string }[];
  teachers: { id: number; firstName: string; lastName: string; prefixName: string }[];
}
export interface ApiErrorBody {
  code?: string;
  message?: string | string[];
  currentClassroom?: { id: number; roomNo: string; roomName: string };
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(
      Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message || `Request failed (${status})`,
    );
  }
}
const base = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new Error("Cannot reach the server. Check the API URL and try again.");
  }
  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await response.json();
    } catch {
      /* no JSON body */
    }
    throw new ApiError(response.status, body);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
export function query(path: string, values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return `${path}?${params}`;
}
