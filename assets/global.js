customElements.define(
  'quiz-step',
  class extends HTMLElement {
    constructor() {
      super();
      this.setQuizzData();
      this.querySelectorAll('.next-step-button').forEach((item) => {
        if (this.isFinalStep) item.addEventListener('click', this.handleLastStep.bind(this));
        else item.addEventListener('click', this.handleNextPreviousStepButtons.bind(this));
      });

      this.querySelectorAll('.previous-step-button').forEach((item) => {
        item.addEventListener('click', this.handleNextPreviousStepButtons.bind(this));
      });

      if (this.isFinalStep && document.getElementById('quiz-contact')) {
        this.quizContactContainer = document.getElementById('quiz-contact');
        this.ajaxifyAndDisplayForm();
      }

      if (this.step <= 1) history.pushState({ currentStep: this.step }, `Step ${this.step}`, this.dataset.stepurl);
    }
    handleLastStep(e) {
      e.preventDefault();
      this.setChoice(e.currentTarget);
      document.querySelector('progress').value = 100;
      this.querySelector('.final-step-container').classList.add('opacity-0');
      this.querySelector('.results-wrapper').classList.remove('opacity-0');
      this.querySelector('.results-wrapper').classList.remove('-z-10');
      this.querySelector('.results-wrapper').classList.add('z-10');

      if (this.quizContactContainer) {
        this.quizContactContainer.classList.remove('hidden');
        this.bindDataToForm();
      } else {
        this.hideProgressShowResults();
      }

      this.renderResults();
    }
    handleNextPreviousStepButtons(e) {
      // Unrelated to wether the transition is supported or no
      const clickedAnchorTag = e.currentTarget;
      const goingForward = clickedAnchorTag.classList.contains('next-step-button');
      if (goingForward) {
        this.setChoice(clickedAnchorTag);
        localStorage.setItem('quiz_manager', JSON.stringify(this.quizManager));
      }

      const viewTransitionApiNotSupported = !document.startViewTransition;
      const lastStepAndGoingBackButton = this.step <= 1 && !goingForward;
      if (viewTransitionApiNotSupported || lastStepAndGoingBackButton) return;

      e.preventDefault();
      
      var disablePushingToHistory = false;
      var goinToTransitionToFirstStep = this.step - 1 <= 1;
      if (!goingForward && goinToTransitionToFirstStep) {
        // First step push state is in constructor
        disablePushingToHistory = true;
      }

      const href = clickedAnchorTag.getAttribute('href');
      this.transitionPage(href, disablePushingToHistory);
    }
    transitionPage(href, disablePushingToHistory = false) {
      document.startViewTransition(() => {
        fetch(href)
          .then((response) => {
            return response.text();
          })
          .then((data) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/html');
            document.querySelector('.quiz-wrapper').replaceWith(doc.querySelector('.quiz-wrapper'));
            if (!disablePushingToHistory) history.pushState({ currentStep: this.step }, `Step ${this.step + 1}`, href);
          });
      });
    }
    ajaxifyAndDisplayForm() {
      const form = this.quizContactContainer.querySelector('form');
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
              this.quizContactContainer.classList.add('hidden');
              this.hideProgressShowResults();
              return;
            }
            throw new Error('Network response was not ok.');
          })
          .catch((error) => {
            console.error('There was a problem with the fetch operation:', error);
          });
      });
    }

    renderResults() {
      this.getRecommendedProduct().then(async (productId) => {
        const recommendedSectionFetchURL = `${window.routes.product_recommendations_url}?section_id=product-finder-recommended&product_id=${productId}&limit=6`;
        const recommendedResponse = await fetch(recommendedSectionFetchURL);
        const recommendedText = await recommendedResponse.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(recommendedText, 'text/html');
        const recommendedResults = doc.querySelector('.results');
        document.querySelector('.results').innerHTML = recommendedResults.innerHTML;
      });
    }
    hideProgressShowResults() {
      document.querySelector('progress').classList.add('hidden');
      this.querySelector('.results-container').classList.remove('hidden');
    }
    setQuizzData() {
      this.quizManager = localStorage.getItem('quiz_manager');

      if (!this.quizManager) this.quizManager = {};
      else this.quizManager = JSON.parse(this.quizManager);

      const { step, quiz, final } = this.dataset;
      if (final) this.isFinalStep = true;
      if (!this.quizManager[quiz]) this.quizManager[quiz] = {};
      this.step = step;
      this.quiz = quiz;
    }

    setChoice(htmlAnchorTagClicked) {
      const { choiceValue } = htmlAnchorTagClicked.dataset;
      if (choiceValue) this.quizManager[this.quiz][this.step] = choiceValue;
    }
    getData() {
      return [...new Set(Object.values(this.quizManager[this.quiz]))];
    }
    bindDataToForm() {
      const input = this.quizContactContainer.querySelector('[name="contact[tags]"]');
      if (!input) return;
      input.value = this.getData().join(',');
    }
    async getRecommendedProduct() {
      let searchTerm = this.getData().join(' OR ');

      const response = await fetch(
        `${routes.predictive_search_url}.json?q=${encodeURIComponent(searchTerm)}&resources[type]=product`
      );
      const suggestions = await response.json();

      if (suggestions.resources.results.products.length) {
        return suggestions.resources.results.products[0].id;
      }
    }
  }
);

const handleBrowserBackButtonWithinQuiz = () => {
  const quizStep = document.querySelector('quiz-step');
  const newURL = document.location.href;
  var disablePushingToHistory = true;
  quizStep.transitionPage(newURL, disablePushingToHistory);
};
window.addEventListener('popstate', handleBrowserBackButtonWithinQuiz);
