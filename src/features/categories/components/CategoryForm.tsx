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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categorySchema, type CategoryInput } from "../schema/categories";
import { createCategoryAction, updateCategoryAction } from "../actions/categories";
import { slugify } from "@/lib/utils";
import { getCategoryName, type CategoryTranslations } from "../utils/translations";
import { useLocale } from "next-intl";

type ParentOption = { id: string; name: string; parentId: string | null; translations: CategoryTranslations | null };

type CreateMode = { mode: "create"; defaultValues?: Partial<CategoryInput> };
type EditMode = {
  mode: "edit";
  categoryId: string;
  defaultValues: CategoryInput;
};
type CategoryFormProps = (CreateMode | EditMode) & {
  /** All existing categories for the parent selector (excluding this category itself in edit mode). */
  parentOptions: ParentOption[];
};

export function CategoryForm(props: CategoryFormProps) {
  const t = useTranslations("adminCategories");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const derivedValues = useMemo<CategoryInput>(
    () => ({
      name: "",
      slug: "",
      parentId: null,
      imageUrl: "",
      description: "",
      translations: { sr: { name: "", description: "" } },
      order: 0,
      isActive: true,
      isFeatured: false,
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying category changes
    // (e.g., user navigates away from the edit page and returns — Next.js can
    // preserve the React tree, so without this the unsaved edits would persist).
    values: props.mode === "edit" ? derivedValues : undefined,
  });

  const nameValue = useWatch({ control: form.control, name: "name" });
  const parentId = useWatch({ control: form.control, name: "parentId" });

  // Auto-slug from name (only if slug is empty)
  useEffect(() => {
    if (!form.getValues("slug")) {
      form.setValue("slug", slugify(nameValue ?? ""), { shouldValidate: false });
    }
  }, [nameValue, form]);

  const onSubmit = (data: CategoryInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateCategoryAction(props.categoryId, data)
          : await createCategoryAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  // Only root categories (parentId = null) can be featured departments
  const isRoot = !parentId;

  // Departments = parentOptions with no parentId themselves
  const departments = props.parentOptions.filter((o) => o.parentId === null);
  const subCategories = props.parentOptions.filter((o) => o.parentId !== null);

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
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("namePlaceholder")} {...field} />
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
                    rows={2}
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
                <FormLabel>{t("name")}</FormLabel>
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
                    rows={2}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Slug */}
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("slug")}</FormLabel>
              <FormControl>
                <Input placeholder="electronics" {...field} />
              </FormControl>
              <FormDescription>{t("slugDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Parent */}
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("parent")}</FormLabel>
              <Select
                value={field.value ?? "none"}
                onValueChange={(v) => field.onChange(v === "none" ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("parentPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent position="popper" className="max-h-72">
                  <SelectItem value="none">{t("noParent")}</SelectItem>
                  {departments.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        {t("departments")}
                      </div>
                      {departments.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {getCategoryName(opt, locale)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {subCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        {t("subcategories")}
                      </div>
                      {subCategories.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {getCategoryName(opt, locale)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <FormDescription>{t("parentDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image URL */}
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("imageUrl")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>{t("imageUrlDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />


        {/* Order */}
        <FormField
          control={form.control}
          name="order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("order")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  className="w-32"
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : e.target.valueAsNumber,
                    )
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormDescription>{t("orderDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* isActive */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel className="text-base">{t("isActive")}</FormLabel>
                <FormDescription>{t("isActiveDesc")}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* isFeatured — only for root departments */}
        {isRoot && (
          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4 border-amber-500/30 bg-amber-500/5">
                <div>
                  <FormLabel className="text-base">{t("isFeatured")}</FormLabel>
                  <FormDescription>{t("isFeaturedDesc")}</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

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