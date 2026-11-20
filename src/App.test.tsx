import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const metadata = {
  prefixes: [{ id: 1, name: "Mr" }],
  genders: [{ id: 1, code: "M", name: "Male" }],
  gradeLevels: [{ id: 1, code: "G1", name: "Grade 1", fullName: "Grade 1" }],
  teachers: [{ id: 1, firstName: "Ada", lastName: "Lee", prefixName: "Ms" }],
};
const student = {
  id: 1,
  studentCode: "S001",
  prefixId: 1,
  prefixName: "Mr",
  firstName: "Sam",
  lastName: "Hill",
  genderId: 1,
  genderName: "Male",
  birthDate: "2015-01-01",
  gradeLevelId: 1,
  gradeLevelName: "Grade 1",
};
const classroom = {
  id: 10,
  roomNo: "101",
  roomName: "Blue",
  academicYear: 2026,
  gradeLevelId: 1,
  gradeLevelName: "Grade 1",
  homeroomTeacherId: 1,
  homeroomTeacherName: "Ms Ada Lee",
};
let calls: Array<{ url: string; method: string; body: Record<string, unknown> | undefined }> = [];
let conflict = false;
beforeEach(() => {
  calls = [];
  conflict = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url.endsWith("/metadata")) return Response.json(metadata);
      if (
        url.includes("/classrooms/10/students") &&
        method === "POST" &&
        conflict &&
        !body?.confirmTransfer
      )
        return Response.json(
          {
            code: "STUDENT_IN_OTHER_CLASSROOM",
            currentClassroom: { id: 11, roomNo: "102", roomName: "Green" },
          },
          { status: 409 },
        );
      if (url.includes("/classrooms/10/students") && method === "GET")
        return Response.json(conflict ? [] : [student]);
      if (url.includes("/students") && method === "GET")
        return Response.json(url.includes("studentCode=OTHER") ? [] : [student]);
      if (url.includes("/classrooms") && method === "GET") return Response.json([classroom]);
      if (method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(url.includes("classrooms") ? classroom : student, {
        status: method === "POST" ? 201 : 200,
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("school management", () => {
  it("searches and creates students", async () => {
    render(<App />);
    await screen.findByText("S001");
    fireEvent.change(screen.getByRole("textbox", { name: "Student code search" }), {
      target: { value: "S001" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Name search" }), {
      target: { value: "Sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search students" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.includes("studentCode=S001") && c.url.includes("name=Sam")),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add student" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Student code" }), {
      target: { value: "S002" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "First name" }), {
      target: { value: "Pat" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Last name" }), {
      target: { value: "Lee" },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Prefix" }));
    fireEvent.click(screen.getByText("Mr", { selector: ".ant-select-item-option-content" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Gender" }));
    fireEvent.click(screen.getByText("Male", { selector: ".ant-select-item-option-content" }));
    fireEvent.change(screen.getByLabelText("Birth date"), { target: { value: "2015-02-02" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Grade level" }));
    fireEvent.click(screen.getByText("Grade 1", { selector: ".ant-select-item-option-content" }));
    fireEvent.click(screen.getByRole("button", { name: "Save student" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/students"))).toBe(true),
    );
  }, 60000);
  it("edits and deletes students", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit student S001" }));
    fireEvent.click(screen.getByRole("button", { name: "Save student" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/students/1"))).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete student S001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm delete" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/students/1"))).toBe(true),
    );
  }, 60000);
  it("searches and creates classrooms", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Classrooms" }));
    await screen.findByText("Blue");
    fireEvent.change(screen.getByRole("textbox", { name: "Room number search" }), {
      target: { value: "101" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Room name search" }), {
      target: { value: "Blue" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Teacher search" }), {
      target: { value: "Ada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search classrooms" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("roomNo=101") &&
            c.url.includes("roomName=Blue") &&
            c.url.includes("teacherName=Ada"),
        ),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add classroom" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Room number" }), {
      target: { value: "102" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Room name" }), {
      target: { value: "Green" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Academic year" }), {
      target: { value: "2026" },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Grade level" }));
    fireEvent.click(screen.getByText("Grade 1", { selector: ".ant-select-item-option-content" }));
    fireEvent.click(screen.getByRole("button", { name: "Save classroom" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/classrooms"))).toBe(true),
    );
  }, 60000);
  it("edits and deletes classrooms and removes roster members", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Classrooms" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit classroom 101" }));
    fireEvent.click(screen.getByRole("button", { name: "Save classroom" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/classrooms/10"))).toBe(
        true,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "View roster 101" }));
    await screen.findByText("Sam Hill");
    fireEvent.click(screen.getByRole("button", { name: "Remove student S001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm remove" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.url.endsWith("/classrooms/10/students/1")),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close roster" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete classroom 101" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm delete" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/classrooms/10"))).toBe(
        true,
      ),
    );
  }, 60000);
  it("retries a transfer only after confirmation and shows the current room", async () => {
    conflict = true;
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Classrooms" }));
    fireEvent.click(await screen.findByRole("button", { name: "View roster 101" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to roster" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Student" }));
    fireEvent.click(
      await screen.findByText(/S001 — Sam Hill/, { selector: ".ant-select-item-option-content" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add selected student" }));
    await screen.findByText(/102.*Green/);
    expect(
      calls.filter((c) => c.method === "POST" && c.url.endsWith("/classrooms/10/students")),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel transfer" }));
    expect(
      calls.filter((c) => c.method === "POST" && c.url.endsWith("/classrooms/10/students")),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Add selected student" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm transfer" }));
    await waitFor(() => expect(calls.some((c) => c.body?.confirmTransfer === true)).toBe(true));
  }, 90000);
});

describe("regressions", () => {
  it("clears editor values when adding after editing and limits code fields to 20 characters", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit student S001" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(screen.getByRole("textbox", { name: "Student code" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Student code" })).toHaveAttribute(
      "maxLength",
      "20",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("tab", { name: "Classrooms" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit classroom 101" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Add classroom" }));
    expect(screen.getByRole("textbox", { name: "Room number" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Room number" })).toHaveAttribute("maxLength", "20");
  }, 60000);
  it("loads all students for the roster picker despite Student page filters", async () => {
    conflict = true;
    render(<App />);
    await screen.findByText("S001");
    fireEvent.change(screen.getByRole("textbox", { name: "Student code search" }), {
      target: { value: "OTHER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search students" }));
    fireEvent.click(screen.getByRole("tab", { name: "Classrooms" }));
    fireEvent.click(await screen.findByRole("button", { name: "View roster 101" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to roster" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Student" }));
    expect(
      await screen.findByText(/S001 — Sam Hill/, { selector: ".ant-select-item-option-content" }),
    ).toBeInTheDocument();
  }, 30000);
});
