"use client";

import type { ConceptOut } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConceptCard({ concept }: { concept: ConceptOut }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{concept.name}</CardTitle>
      </CardHeader>
      {concept.description && (
        <CardContent>
          <p className="text-sm leading-[1.7] text-muted-foreground">{concept.description}</p>
        </CardContent>
      )}
    </Card>
  );
}
