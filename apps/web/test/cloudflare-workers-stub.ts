type BindingFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const unavailable: BindingFetch = () => Promise.reject(new Error("API binding is unavailable"));

let bindingFetch: BindingFetch = unavailable;

export function setApiFetch(fetch: BindingFetch): void {
  bindingFetch = fetch;
}

export function resetApiFetch(): void {
  bindingFetch = unavailable;
}

export const env = {
  API: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      return bindingFetch(input, init);
    },
  },
};
