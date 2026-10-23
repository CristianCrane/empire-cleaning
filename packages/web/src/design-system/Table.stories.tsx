import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { expect } from "storybook/test";
import { StatusBadge } from "./StatusBadge.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "./Table.tsx";

const quotes = [
  {
    id: 1,
    client: "Casey Client",
    property: "41-12 Austin St",
    price: 185,
    status: "Sent",
  },
  {
    id: 2,
    client: "Dana Doe",
    property: "108-20 71st Ave",
    price: 240,
    status: "Accepted",
  },
  {
    id: 3,
    client: "Eli Evans",
    property: "35-06 Ditmars Blvd",
    price: 150,
    status: "Draft",
  },
  {
    id: 4,
    client: "Fran Fox",
    property: "62-15 Woodhaven Blvd",
    price: 310,
    status: "Expired",
  },
] as const;

const tone = {
  Draft: "neutral",
  Sent: "info",
  Accepted: "success",
  Expired: "neutral",
} as const;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const meta = {
  title: "Components/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table aria-label="Quotes">
      <TableHeader>
        <Column isRowHeader>Client</Column>
        <Column>Property</Column>
        <Column>Price</Column>
        <Column>Status</Column>
      </TableHeader>
      <TableBody items={quotes}>
        {(quote) => (
          <Row>
            <Cell>{quote.client}</Cell>
            <Cell>{quote.property}</Cell>
            <Cell className="tabular-nums">{usd.format(quote.price)}</Cell>
            <Cell>
              <StatusBadge tone={tone[quote.status]}>
                {quote.status}
              </StatusBadge>
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  ),
};

function SortableQuotes() {
  const [sort, setSort] = useState<SortDescriptor>({
    column: "price",
    direction: "ascending",
  });
  const sorted = [...quotes].sort((a, b) => {
    const key = sort.column as "client" | "price";
    const order = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
    return sort.direction === "descending" ? -order : order;
  });

  return (
    <Table aria-label="Quotes" sortDescriptor={sort} onSortChange={setSort}>
      <TableHeader>
        <Column id="client" isRowHeader allowsSorting>
          Client
        </Column>
        <Column id="price" allowsSorting>
          Price
        </Column>
      </TableHeader>
      <TableBody items={sorted}>
        {(quote) => (
          <Row>
            <Cell>{quote.client}</Cell>
            <Cell className="tabular-nums">{usd.format(quote.price)}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

export const Sortable: Story = {
  render: () => <SortableQuotes />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("columnheader", { name: /price/i }));

    const [, first] = canvas.getAllByRole("row");
    await expect(first).toHaveTextContent("Fran Fox");
  },
};

export const Empty: Story = {
  render: () => (
    <Table aria-label="Quotes">
      <TableHeader>
        <Column isRowHeader>Client</Column>
        <Column>Status</Column>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">No Quotes yet.</p>
        )}
      >
        {[]}
      </TableBody>
    </Table>
  ),
};
