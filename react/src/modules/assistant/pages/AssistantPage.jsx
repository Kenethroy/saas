import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getAssistantStatus, queryAssistant, reindexAssistant } from "@/modules/assistant/api/assistant.api";
import { PageIntro } from "@/shared/components/common/PageIntro";
import { useAuthUser } from "@/shared/hooks/useAuthUser";
import { useNotification } from "@/shared/hooks/useNotification";
import { canAccess } from "@/shared/utils/access-control";

function extractErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message || error?.message || fallbackMessage;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value instanceof Date ? value : new Date(value));
}

function createMessage(role, content, extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function MessageCard({ message, onSuggestionClick }) {
  const isUser = message.role === "user";

  return (
    <article
      className={`rounded-[20px] border px-4 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ${
        isUser
          ? "border-[#d8e5ee] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafc_100%)]"
          : "border-[#cfe0ec] bg-[radial-gradient(circle_at_top_right,rgba(0,112,184,0.08),transparent_28%),linear-gradient(180deg,#fcfeff_0%,#f4f8fb_100%)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#5f7b93]">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
              isUser ? "bg-[#17324d] text-white" : "bg-[#0070b8] text-white"
            }`}
          >
            <i className={`fas ${isUser ? "fa-user" : "fa-robot"} text-[13px]`} aria-hidden="true" />
          </span>
          {isUser ? "You" : "Assistant"}
        </div>
        <div className="text-[11px] text-[#7a92a6]">{formatDateTime(message.createdAt)}</div>
      </div>

      <div className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-[#18324a]">{message.content}</div>

      {!isUser && message.confidence ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="inline-flex items-center rounded-full border border-[#d4e2ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#60798e]">
            {message.confidence} confidence
          </div>
          {message.mode ? (
            <div className="inline-flex items-center rounded-full border border-[#d4e2ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#60798e]">
              {message.mode === "ai_grounded" ? "AI grounded" : message.mode}
            </div>
          ) : null}
          {message.model ? (
            <div className="inline-flex items-center rounded-full border border-[#d4e2ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#60798e]">
              {message.model}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isUser && Array.isArray(message.sources) && message.sources.length > 0 ? (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#60798e]">Sources</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {message.sources.map((source) => (
              <Link
                key={`${source.type}-${source.id}-${source.title}`}
                to={source.path || "#"}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7e4ec] bg-white px-3 py-2 text-[12px] font-semibold text-[#1a3557] transition hover:border-[#0070b8] hover:text-[#0070b8]"
              >
                <i className="fas fa-link text-[11px]" aria-hidden="true" />
                <span>{source.title}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!isUser && Array.isArray(message.suggestions) && message.suggestions.length > 0 ? (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#60798e]">Suggested Follow-ups</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="rounded-full border border-[#cfe0ec] bg-[#eef6fb] px-3 py-2 text-[12px] font-semibold text-[#0f4b73] transition hover:border-[#0070b8] hover:bg-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function AssistantPage() {
  const [searchParams] = useSearchParams();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const queryClient = useQueryClient();
  const notification = useNotification();
  const { user } = useAuthUser();
  const customerId = searchParams.get("customerId");
  const customerName = searchParams.get("customerName");
  const canManageAssistant = canAccess(user, { permission: "settings.view" });

  const quickPrompts = useMemo(() => {
    if (customerId) {
      const label = customerName || "this customer";

      return [
        `Summarize ${label}'s account health`,
        `Why is ${label} overdue?`,
        `What is the latest payment for ${label}?`
      ];
    }

    return [
      "Which customers are overdue right now?",
      "Show me our top products",
      "Summarize our relationship with a supplier",
      "Why is ABC Hardware overdue?"
    ];
  }, [customerId, customerName]);

  const mutation = useMutation({
    mutationFn: async (nextQuestion) => {
      const payload = {
        question: nextQuestion
      };

      if (customerId) {
        payload.context = {
          customerId: Number(customerId),
          module: "customers"
        };
      }

      return queryAssistant(payload);
    },
    onSuccess: (response, submittedQuestion) => {
      setMessages((current) => [
        ...current,
        createMessage("user", submittedQuestion),
        createMessage("assistant", response?.data?.answer ?? "No answer was returned.", {
          confidence: response?.data?.confidence ?? null,
          mode: response?.data?.mode ?? null,
          model: response?.data?.model ?? null,
          sources: response?.data?.sources ?? [],
          suggestions: response?.data?.suggestions ?? []
        })
      ]);
      setQuestion("");
    },
    onError: (error, submittedQuestion) => {
      const message = extractErrorMessage(error, "Assistant request failed.");

      setMessages((current) => [
        ...current,
        createMessage("user", submittedQuestion),
        createMessage("assistant", message)
      ]);
      notification.error(message);
    }
  });

  const {
    data: statusResponse,
    isLoading: isStatusLoading
  } = useQuery({
    queryKey: ["assistant", "status"],
    queryFn: getAssistantStatus,
    enabled: canManageAssistant
  });

  const reindexMutation = useMutation({
    mutationFn: () => reindexAssistant({
      scope: ["customers", "products", "suppliers"]
    }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["assistant", "status"] });
      notification.success("Assistant reindex completed for all modules.");
    },
    onError: (error) => {
      notification.error(extractErrorMessage(error, "Assistant reindex failed."));
    }
  });

  const assistantStatus = statusResponse?.data ?? null;

  function handleSubmit(event) {
    event.preventDefault();

    const nextQuestion = question.trim();
    if (!nextQuestion || mutation.isPending) {
      return;
    }

    mutation.mutate(nextQuestion);
  }

  function handleSuggestionClick(nextQuestion) {
    setQuestion(nextQuestion);
    if (!mutation.isPending) {
      mutation.mutate(nextQuestion);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Assistant"
        title="JRSPC Intelligence Assistant"
        description="Ask questions about customers, products, and suppliers using live JRSPC internal data. The assistant provides deterministic, grounded answers based on real-time records."
      />

      {customerId ? (
        <section className="rounded-[18px] border border-[#d6e4ed] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9fc_100%)] px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#60798e]">Attached Context</div>
              <div className="mt-1 text-[15px] font-bold text-[#17324d]">{customerName || "Customer record"}</div>
              <div className="mt-1 text-[12px] text-[#607d8b]">Questions will use customer #{customerId} as the primary context.</div>
            </div>
            <Link
              to={`/customers/${customerId}`}
              className="inline-flex items-center gap-2 rounded-full border border-[#cfe0ec] bg-white px-4 py-2 text-[12px] font-semibold text-[#17324d] transition hover:border-[#0070b8] hover:text-[#0070b8]"
            >
              <i className="fas fa-arrow-up-right-from-square text-[11px]" aria-hidden="true" />
              Open Customer Record
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-[22px] border border-[#d7e4ec] bg-[radial-gradient(circle_at_top_right,rgba(0,112,184,0.08),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f4f8fb_100%)] px-5 py-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#60798e]">Query Surface</div>
                <div className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-[#17324d]">Ask for account health, product pricing, or supplier summaries.</div>
              </div>
              <div className="inline-flex items-center rounded-full border border-[#d7e4ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#60798e]">
                Full Data Scope
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5">
              <label className="block">
                <span className="sr-only">Assistant question</span>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={5}
                  placeholder="Ask a business question..."
                  className="w-full rounded-[18px] border border-[#cfe0ec] bg-white px-4 py-4 text-[14px] leading-7 text-[#17324d] outline-none transition focus:border-[#0070b8] focus:ring-2 focus:ring-[#bfdef3]"
                />
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuestion(prompt)}
                      className="rounded-full border border-[#d1dfeb] bg-white px-3 py-2 text-[12px] font-semibold text-[#33556f] transition hover:border-[#0070b8] hover:text-[#0070b8]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending || question.trim().length < 2}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#17324d] px-5 py-3 text-[13px] font-bold text-white transition hover:bg-[#0f2439] disabled:cursor-not-allowed disabled:bg-[#9fb2c2]"
                >
                  <i className={`fas ${mutation.isPending ? "fa-spinner fa-spin" : "fa-paper-plane"}`} aria-hidden="true" />
                  {mutation.isPending ? "Thinking..." : "Ask Assistant"}
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            {messages.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#cfe0ec] bg-white px-5 py-10 text-center shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#eef6fb] text-[#0070b8]">
                  <i className="fas fa-robot text-[22px]" aria-hidden="true" />
                </div>
                <div className="mt-4 text-[18px] font-bold text-[#17324d]">No assistant conversation yet.</div>
                <div className="mt-2 text-[13px] text-[#607d8b]">Start with a business question or use one of the quick prompts above.</div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageCard key={message.id} message={message} onSuggestionClick={handleSuggestionClick} />
              ))
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[20px] border border-[#d7e4ec] bg-white px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#60798e]">Current Capabilities</div>
            <div className="mt-3 space-y-3 text-[13px] text-[#466277]">
              <div className="flex gap-3">
                <i className="fas fa-circle-info mt-1 text-[11px] text-[#0070b8]" aria-hidden="true" />
                <span>Summarize accounts using live customer, receivable, and payment data.</span>
              </div>
              <div className="flex gap-3">
                <i className="fas fa-circle-info mt-1 text-[11px] text-[#0070b8]" aria-hidden="true" />
                <span>Retrieve product pricing, descriptions, and stock availability.</span>
              </div>
              <div className="flex gap-3">
                <i className="fas fa-circle-info mt-1 text-[11px] text-[#0070b8]" aria-hidden="true" />
                <span>Analyze supplier relationships, purchasing history, and payables.</span>
              </div>
              <div className="flex gap-3">
                <i className="fas fa-circle-info mt-1 text-[11px] text-[#0070b8]" aria-hidden="true" />
                <span>Return grounded source links back into the JRSPC app.</span>
              </div>
            </div>
          </section>

          {canManageAssistant ? (
            <section className="rounded-[20px] border border-[#d7e4ec] bg-white px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#60798e]">Index Control</div>
                  <div className="mt-1 text-[15px] font-bold text-[#17324d]">Semantic business index</div>
                </div>
                <button
                  type="button"
                  onClick={() => reindexMutation.mutate()}
                  disabled={reindexMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#17324d] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#0f2439] disabled:cursor-not-allowed disabled:bg-[#9fb2c2]"
                >
                  <i className={`fas ${reindexMutation.isPending ? "fa-spinner fa-spin" : "fa-rotate"}`} aria-hidden="true" />
                  {reindexMutation.isPending ? "Reindexing..." : "Reindex All"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-[#d7e4ec] bg-[#f8fbfd] px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d8599]">Indexed Documents</div>
                  <div className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#17324d]">
                    {isStatusLoading ? "..." : assistantStatus?.indexStats?.documents ?? 0}
                  </div>
                </div>
                <div className="rounded-[16px] border border-[#d7e4ec] bg-[#f8fbfd] px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6d8599]">Indexed Chunks</div>
                  <div className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#17324d]">
                    {isStatusLoading ? "..." : assistantStatus?.indexStats?.chunks ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-[12px] text-[#466277]">
                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e1ebf1] bg-[#fcfeff] px-3 py-2">
                  <span>Chat provider configured</span>
                  <span className="font-bold text-[#17324d]">{assistantStatus?.ai?.chatConfigured ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e1ebf1] bg-[#fcfeff] px-3 py-2">
                  <span>Embedding provider configured</span>
                  <span className="font-bold text-[#17324d]">{assistantStatus?.ai?.embeddingsConfigured ? "Yes" : "No"}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[20px] border border-[#d7e4ec] bg-[linear-gradient(180deg,#fcfeff_0%,#f5f9fc_100%)] px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#60798e]">Implementation Note</div>
            <div className="mt-3 text-[13px] leading-7 text-[#466277]">
              The assistant now supports a hybrid path: live business retrieval is still the source of truth, while indexed customer, product, and supplier summaries can enrich the final response when configured.
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
