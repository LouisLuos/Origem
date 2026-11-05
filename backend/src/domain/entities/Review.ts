export interface ReviewProps {
  id: string
  name: string
  location: string
  quote: string
  rating: number
  avatarUrl: string
  avatarAlt: string
  createdAt?: Date
}

export class Review {
  public readonly id: string
  public readonly name: string
  public readonly location: string
  public readonly quote: string
  public readonly rating: number
  public readonly avatarUrl: string
  public readonly avatarAlt: string
  public readonly createdAt?: Date

  constructor(props: ReviewProps) {
    this.id = props.id
    this.name = props.name
    this.location = props.location
    this.quote = props.quote
    this.rating = props.rating
    this.avatarUrl = props.avatarUrl
    this.avatarAlt = props.avatarAlt
    this.createdAt = props.createdAt
  }
}

