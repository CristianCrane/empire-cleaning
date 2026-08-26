export type Test = "This" | "Is" | "A" | "Test";

export type Test2 = {
  this: 1;
  is: true;
  a: ["123"];
  test: () => {};
};

export enum UserRole {
  Admin = "ADMIN",
  User = "USER",
  Guest = "Guest",
}

type ID = string;

export interface BaseIdentity {
  readonly id: ID;
  createdAt: Date;
}
