let router = document.querySelector('quiz-router');
const quizManager = {
  state: {
    responses: {},
    progress: {
      currentStep: 1,
      nextStep: 2,
      totalSteps: parseInt(document.querySelector('quiz-router')?.dataset.totalsteps),
    },
  },
  setAnswer: (key, value) => {
    quizManager.state.responses[key] = value;
  },
  setProgress: (key, value) => {
    quizManager.state.progress[key] = value;
  },
  updateProgressBar: (goingForward) => {
    let currentStep = quizManager.state.progress.currentStep;
    let nextStep = quizManager.state.progress.nextStep;
    if (goingForward) {
      currentStep = nextStep;
      nextStep = nextStep + 1;
    } else {
      nextStep = currentStep;
      currentStep = currentStep - 1;
    }
    quizManager.setProgress('currentStep', currentStep);
    quizManager.setProgress('nextStep', nextStep);
    document
      .querySelector('progress')
      .setAttribute('value', (currentStep * 100) / quizManager.state.progress.totalSteps);
  },
  getData: () => {
    return [...new Set(Object.values(quizManager.state.responses))];
  },
  bindDataToForm: () => {
    const input = document.querySelector('[name="contact[tags]"]');
    if (!input) return;

    input.value = quizManager.getData().join(',');
  },
  getRecommendedProduct: async () => {
    // TODO: Get the recommended product based on diffrent approches
    // You can use an API like Open AI or a JSON file (Metobjects)
    // to return a product ID based on the quiz data.

    // you can put space in case you want an AND relationship between the answers
    const searchTerm = quizManager.getData().join(' OR ');

    const response = await fetch(
      `${routes.predictive_search_url}.json?q=${encodeURIComponent(searchTerm)}&resources[type]=product`
    );
    const suggestions = await response.json();
    console.log(suggestions);
    if (suggestions.resources.results.products.length) {
      return suggestions.resources.results.products[0].id;
    }
  },
  hideEmailDisplayContent: () => {
    const contactQuizzContainer = document.getElementById('quiz-contact');
    contactQuizzContainer.classList.add('hidden');
    contactQuizzContainer.classList.remove('flex');
    document.querySelector('.quiz-final-content').classList.remove('hidden');
    document.querySelector('progress').classList.add('hidden');
  },
  ajaxifyAndDisplayForm: () => {
    const contactQuizzContainer = document.getElementById('quiz-contact');
    const form = contactQuizzContainer.querySelector('form');
    form.addEventListener('submit', (event) => {
      event.stopPropagation();
      event.preventDefault();

      const form = event.target;
      const formData = new FormData(form);
      const action = form.getAttribute('action');
      fetch(action, {
        method: 'POST',
        body: formData,
      })
        .then((response) => {
          if (response.ok) {
            quizManager.hideEmailDisplayContent();
          }
          throw new Error('Network response was not ok.');
        })
        .catch((error) => {
          console.error('There was a problem with the fetch operation:', error);
        });
    });
  },
};

customElements.define(
  'quiz-router',
  class extends HTMLElement {
    constructor() {
      super();
      this.buttons = this.querySelectorAll('[type="button"]');
      if (this.buttons.length < 1) return;
      this.buttons.forEach((button) => button.addEventListener('click', this.switch.bind(this)));
    }

    async switch(event) {
      const { currentStep, nextStep, totalSteps } = quizManager.state.progress;
      const button = event.target;
      button.disabled = true;
      if (button.dataset.value) {
        quizManager.setAnswer(`step-${currentStep}`, button.dataset.value);
      }

      const shouldRenderResults = currentStep >= totalSteps;
      if (shouldRenderResults) {
        this.renderProductRecommendations();
        quizManager.updateProgressBar(true);

        return;
      }

      if (button.dataset.value) {
        quizManager.setAnswer(`step-${currentStep}`, button.dataset.value);
      }

      const nextStepUrl = this.getStepUrl(button);

      const response = await fetch(`https://${nextStepUrl}`);
      const htmlString = await response.text();
      this.renderContents(htmlString);

      quizManager.updateProgressBar(button.dataset.next ? true : false);

      // history.pushState({ currentStep, nextStep }, `Step ${nextStep}`, `${window.location.pathname}?step=${nextStep}`);
    }
    getStepUrl(button) {
      return button.dataset.next
        ? window.location.host + button.dataset.next
        : window.location.host + button.dataset.previous;
    }
    renderContents(htmlString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const sectionElement = doc.querySelector('quiz-router');
      this.replaceWith(sectionElement);
    }
    async renderProductRecommendations() {
      const quizFinalSectionFetchURL = `${window.location.href}?section_id=quiz-final`;
      const quizFinalResponse = await fetch(quizFinalSectionFetchURL);
      const quizFinalText = await quizFinalResponse.text();
      this.renderContents(quizFinalText);

      quizManager.getRecommendedProduct().then(async (productId) => {
        if (productId) {
          const recommendedSectionFetchURL = `${window.routes.product_recommendations_url}?section_id=quiz-recommended&product_id=${productId}&limit=6`;
          const recommendedResponse = await fetch(recommendedSectionFetchURL);
          const recommendedText = await recommendedResponse.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(recommendedText, 'text/html');
          const recommendedResults = doc.querySelector('.results');
          document.querySelector('.results').innerHTML = recommendedResults.innerHTML;
          if (document.getElementById('quiz-contact')) {
            quizManager.bindDataToForm();
            quizManager.ajaxifyAndDisplayForm();
          } else {
            document.querySelector('progress').classList.add('hidden');
          }
        } else {
          quizManager.hideEmailDisplayContent();
        }
      });
    }
  }
);
