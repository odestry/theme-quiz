const quizManager = {
  data: {},
  setData: (key, value) => {
    quizManager.data[key] = value
  },
  getData: () => {
    return [...new Set(Object.values(quizManager.data))]
  },
  bindDataToForm: () => {
    const input = document.querySelector('[name="contact[tags]"]')
    if (!input) return

    input.value = quizManager.getData().join(',')
  },
  getRecommendedProduct: async () => {
    // TODO: Get the recommended product based on diffrent approches
    // You can use an API like Open AI or a JSON file (Metobjects)
    // to return a product ID based on the quiz data.
    const searchTerm = quizManager.getData().join(' ')

    const response = await fetch(
      `${routes.predictive_search_url}.json?q=${encodeURIComponent(
        searchTerm
      )}&resources[type]=product`
    )
    const suggestions = await response.json()

    if (suggestions.resources.results.products.length) {
      return suggestions.resources.results.products[0].id
    }
  }
}

customElements.define(
  'quiz-router',
  class extends HTMLElement {
    constructor() {
      super()
      this.state = {
        currentStep: parseInt(this.dataset.currentStep),
        nextStep: parseInt(this.dataset.nextStep)
      }
      if (!this.state.nextStep) {
        this.renderProductRecommendations()
        quizManager.bindDataToForm()
        return
      }

      this.buttons = this.querySelectorAll('[type="button"]')
      if (this.buttons.length < 1) return
      this.buttons.forEach(button =>
        button.addEventListener('click', this.switch.bind(this))
      )
    }

    async switch(event) {
      const { currentStep, nextStep } = this.state
      const button = event.target
      button.disabled = true

      if (button.dataset.value) {
        quizManager.setData(`step-${currentStep}`, button.dataset.value)
      }

      const response = await fetch(
        `${window.location.pathname}?sections=${
          this.getSectionToRender(nextStep).id
        }`,
        this.fetchConfig()
      )
      const parsedState = await response.json()
      this.renderContents(parsedState, currentStep)
      history.pushState(
        { currentStep, nextStep },
        `Step ${nextStep}`,
        `${window.location.pathname}?step=${nextStep}`
      )
    }

    renderContents(parsedState, step) {
      const section = this.getSectionToRender(step),
        newSection = this.getSectionToRender(step + 1)
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id)
      sectionElement.parentElement.innerHTML = this.getSectionInnerHTML(
        parsedState[newSection.id]
      )
    }

    getSectionInnerHTML(html, selector = '.shopify-section') {
      return new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector(selector).innerHTML
    }

    getSectionToRender(step) {
      return {
        id: step === 0 ? 'main-quiz' : `quiz-step-${step}`,
        selector: step === 0 ? '.main-quiz' : `.quiz-step-${step}`
      }
    }

    fetchConfig(type = 'json') {
      return { method: 'GET', headers: { Accept: `application/${type}` } }
    }

    renderProductRecommendations() {
      const recommendationsElement = document.querySelector('.results')
      const handleIntersection = (entries, observer) => {
        if (!entries[0].isIntersecting) return
        observer.unobserve(this)

        quizManager.getRecommendedProduct().then(productId => {
          const fetchURL = `${
            window.routes.product_recommendations_url
          }?section_id=${
            this.getSectionToRender(this.state.currentStep).id
          }&product_id=${productId}&limit=6`

          fetch(fetchURL)
            .then(response => response.text())
            .then(text => {
              const html = document.createElement('div')
              html.innerHTML = text
              const recommendations = html.querySelector('.results')
              if (recommendations && recommendations.innerHTML.trim().length) {
                recommendationsElement.innerHTML = recommendations.innerHTML
              }
            })
        })
      }

      new IntersectionObserver(handleIntersection.bind(this), {
        rootMargin: '0px 0px 400px 0px'
      }).observe(this)
    }
  }
)
