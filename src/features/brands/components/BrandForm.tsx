"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createBrandSchema, updateBrandSchema, CreateBrandInput, UpdateBrandInput } from "../schema/brands";
import { createBrandAction, updateBrandAction } from "../actions/brands";
import { slugify } from "@/lib/utils";

type CreateMode = {
  mode: "create";
  defaultValues?: Partial<CreateBrandInput>;
};

type EditMode = {
  mode: "edit";
  brandId: string;
  defaultValues: UpdateBrandInput;
};

type BrandFormProps = CreateMode | EditMode;

export function BrandForm(props: BrandFormProps) {
  const t = useTranslations("brands");
  const [isPending, startTransition] = useTransition();

  const derivedValues = useMemo<CreateBrandInput>(
    () => ({
      name: "",
      slug: "",
      logoUrl: "",
      description: "",
      translations: { sr: { name: "", description: "" } },
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const form = useForm<CreateBrandInput>({
    resolver: zodResolver(props.mode === "create" ? createBrandSchema : updateBrandSchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying brand changes
    // (e.g., user navigates away from the edit page and returns — Next.js can
    // preserve the React tree, so without this the unsaved edits would persist).
    values: props.mode === "edit" ? derivedValues : undefined,
  });

  const nameValue = useWatch({ control: form.control, name: "name" });

  useEffect(() => {
    const currentSlug = form.getValues("slug");
    if (!currentSlug) {
      form.setValue("slug", slugify(nameValue ?? ""), { shouldValidate: false });
    }
  }, [nameValue, form]);

  const onSubmit = (data: CreateBrandInput | UpdateBrandInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateBrandAction(props.brandId, data)
          : await createBrandAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {/* ── English ── */}
        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            🇬🇧 {t("langEn")}
          </p>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("brandName")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("brandNamePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("description")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("descPlaceholder")}
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Serbian ── */}
        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            🇷🇸 {t("langSr")}
          </p>

          <FormField
            control={form.control}
            name="translations.sr.name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("brandName")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("nameSrPlaceholder")}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="translations.sr.description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("description")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("descSrPlaceholder")}
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("slug")}</FormLabel>
              <FormControl>
                <Input placeholder={t("slugPlaceholder")} {...field} />
              </FormControl>
              <FormDescription>{t("slugDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("logoUrl")}</FormLabel>
              <FormControl>
                <Input placeholder={t("logoPlaceholder")} {...field} />
              </FormControl>
              <FormDescription>{t("logoDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {props.mode === "edit" ? t("saving") : t("creating")}
            </>
          ) : props.mode === "edit" ? (
            t("saveChanges")
          ) : (
            t("create")
          )}
        </Button>
      </form>
    </Form>
  );
}