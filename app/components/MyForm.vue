<script setup lang="ts">
import { reactive } from "vue";
import type { FormSubmitEvent } from "@nuxt/ui";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

type FormData = z.output<typeof schema>;

const emit = defineEmits<{
  (e: "submitData", data: FormData): void;
}>();

const form = useTemplateRef<InstanceType<typeof import("#ui/types").Form>>("form");

const formState = reactive<FormData>({ name: "", value: "" });

function onSubmit(event: FormSubmitEvent<FormData>): void {
  emit("submitData", event.data);
}

async function triggerFormSubmit(): Promise<void> {
  if (form.value) {
    console.log("Form ref is available, submitting form...");
    await form.value.submit();
  }
}

defineExpose({ triggerFormSubmit });
</script>

<template>
  <UForm
    ref="form"
    data-testid="my-form"
    :schema="schema"
    :state="formState"
    @submit="onSubmit"
  >
    <UFormField
      data-testid="form-name-field"
      label="Name"
      name="name"
    >
      <UInput
        v-model="formState.name"
        placeholder="Name"
      />
    </UFormField>

    <UFormField
      data-testid="form-value-field"
      label="Value"
      name="value"
    >
      <UInput
        v-model="formState.value"
        placeholder="Value"
      />
    </UFormField>
  </UForm>
</template>